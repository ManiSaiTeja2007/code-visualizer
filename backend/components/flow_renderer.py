import ast
import graphviz

# --- CONFIGURATION CONSTANTS (To prevent magic numbers) ---
MAX_WINDOW_FALLBACK_LINES = 12
WINDOW_LINE_PADDING_BEFORE = 3
WINDOW_LINE_PADDING_AFTER = 4
MAX_LABEL_TEXT_LENGTH = 40
LABEL_TRUNCATE_LEN = 37
FALLBACK_LABEL_PREVIEW_LIMIT = 35

# Color styling tokens for the visualization nodes
COLOR_ACTIVE_BG = '#FF3366'
COLOR_ACTIVE_BORDER = '#FF3366'
COLOR_INACTIVE_BG = '#1A1A2E'
COLOR_INACTIVE_BORDER = '#333355'
COLOR_EXIT_BG = '#2E1A47'
COLOR_START_GLOBAL_BG = '#2E1A47'
COLOR_START_FUNC_BG = '#1A2E3B'
COLOR_FN_DECL_BG = '#1C2E2A'
COLOR_IF_BG = '#332211'
COLOR_LOOP_BG = '#331122'
COLOR_RETURN_BG = '#2E1A24'

# Thickness of node borders
PEN_WIDTH_ACTIVE = '3.0'
PEN_WIDTH_DEFAULT = '1.5'

# Placeholder line number for end node
LINE_NO_END_PLACEHOLDER = 999999


class FlowRenderer:
    """
    Renders abstract syntax trees (AST) into clean, visual Control Flow Graphs (CFG) using Graphviz.
    Falls back to a sequential local windowing flowchart if compilation fails or code is not Python.
    """
    def __init__(self, code_str, active_line=None):
        self.code_str = code_str
        self.active_line = active_line

    def generate_dot(self):
        """
        Generates a Graphviz Digraph representation of the source code.
        Will use fallback sequential rendering if AST parsing fails.
        """
        dot = graphviz.Digraph(comment="Control Flow Graph")
        dot.attr(bgcolor="#0F0F1A")
        dot.attr('node', 
                 fontname='Courier New, JetBrains Mono', 
                 style='filled,rounded', 
                 shape='box',
                 fillcolor=COLOR_INACTIVE_BG, 
                 color=COLOR_INACTIVE_BORDER, 
                 fontcolor='#CCCCCC',
                 penwidth=PEN_WIDTH_DEFAULT)
        dot.attr('edge', 
                 fontname='Courier New, JetBrains Mono',
                 color='#444466', 
                 fontcolor='#8888AA',
                 arrowsize='0.8',
                 penwidth='1.2')

        try:
            tree = ast.parse(self.code_str)
        except Exception:
            # Fallback to local sequential windowing
            lines = self.code_str.strip().split('\n')
            total_lines = len(lines)
            
            if total_lines > MAX_WINDOW_FALLBACK_LINES and self.active_line is not None:
                start_win = max(1, self.active_line - WINDOW_LINE_PADDING_BEFORE)
                end_win = min(total_lines, self.active_line + WINDOW_LINE_PADDING_AFTER)
            else:
                start_win = 1
                end_win = total_lines
                
            prev_id = None
            if start_win > 1:
                dot.node("win_start", "... (outer scope) ...", fillcolor="#0F0F1A", color="#444466", fontcolor="#666688", shape="ellipse")
                prev_id = "win_start"
                
            for idx in range(start_win - 1, end_win):
                line_no = idx + 1
                line = lines[idx]
                label = f"Line {line_no}: {line.strip()[:FALLBACK_LABEL_PREVIEW_LIMIT]}"
                is_active = (self.active_line == line_no)
                
                node_id = f"line_{line_no}"
                bg = COLOR_ACTIVE_BG if is_active else COLOR_INACTIVE_BG
                fg = '#FFFFFF' if is_active else '#CCCCCC'
                border = COLOR_ACTIVE_BORDER if is_active else COLOR_INACTIVE_BORDER
                pen = PEN_WIDTH_ACTIVE if is_active else PEN_WIDTH_DEFAULT
                
                dot.node(node_id, label, fillcolor=bg, color=border, fontcolor=fg, penwidth=pen, id=f"cfg_node_{line_no}")
                if prev_id:
                    dot.edge(prev_id, node_id)
                prev_id = node_id
                
            if end_win < total_lines:
                dot.node("win_end", "... (outer scope) ...", fillcolor="#0F0F1A", color="#444466", fontcolor="#666688", shape="ellipse")
                if prev_id:
                    dot.edge(prev_id, "win_end")
            return dot

        # Find if active line lies inside a function definition (for scope focus)
        active_func_node = None
        if self.active_line is not None:
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef):
                    if node.lineno <= self.active_line <= (node.end_lineno or node.lineno):
                        if active_func_node is None or (node.end_lineno - node.lineno < active_func_node.end_lineno - active_func_node.lineno):
                            active_func_node = node

        # Walk AST to construct focused blocks
        builder = CFGBuilder(self.active_line, active_func_node)
        if active_func_node:
            builder.visit_FunctionDef_focused(active_func_node)
        else:
            builder.visit_Global(tree)
        return builder.get_dot()

    def generate_all_scopes_svg(self) -> dict:
        """
        Precompiles and returns a dictionary of all scope flowcharts (global and individual function scopes).
        Returns a single global key if compilation fails.
        """
        scopes = {}
        try:
            tree = ast.parse(self.code_str)
        except Exception:
            dot = self.generate_dot()
            scopes["global"] = dot.pipe(format="svg").decode("utf-8")
            return scopes

        # 1. Build Global Scope
        builder = CFGBuilder(active_line=None, active_func_node=None)
        builder.visit_Global(tree)
        dot_global = builder.get_dot()
        scopes["global"] = dot_global.pipe(format="svg").decode("utf-8")

        # 2. Build each Function Scope
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                builder_func = CFGBuilder(active_line=None, active_func_node=node)
                builder_func.visit_FunctionDef_focused(node)
                dot_func = builder_func.get_dot()
                scopes[node.name] = dot_func.pipe(format="svg").decode("utf-8")

        return scopes


class CFGBuilder(ast.NodeVisitor):
    """
    AST node visitor that compiles python statement nodes into a hierarchical graphviz flow representation.
    """
    def __init__(self, active_line, active_func_node=None):
        self.dot = graphviz.Digraph(comment="CFG")
        self.dot.attr(bgcolor="#0F0F1A")
        self.dot.attr('node', 
                      fontname='Courier New, JetBrains Mono', 
                      style='filled,rounded', 
                      shape='box',
                      fillcolor=COLOR_INACTIVE_BG, 
                      color=COLOR_INACTIVE_BORDER, 
                      fontcolor='#CCCCCC',
                      penwidth=PEN_WIDTH_DEFAULT)
        self.dot.attr('edge', 
                      fontname='Courier New, JetBrains Mono',
                      color='#444466', 
                      fontcolor='#8888AA',
                      arrowsize='0.8',
                      penwidth='1.2')
        
        self.active_line = active_line
        self.active_func_node = active_func_node
        self.node_id_counter = 0
        self.current_nodes = []
        self.start_node = None

    def next_id(self):
        """Generates a unique sequence node key."""
        self.node_id_counter += 1
        return f"n_{self.node_id_counter}"

    def add_node(self, label, start_line, end_line, shape="box", fillcolor=None):
        """Appends a new vertex block to the flowchart graph with visual highlight parameters."""
        nid = self.next_id()
        is_active = False
        if self.active_line is not None and start_line <= self.active_line <= end_line:
            is_active = True

        bg = COLOR_ACTIVE_BG if is_active else (fillcolor or COLOR_INACTIVE_BG)
        fg = '#FFFFFF' if is_active else '#CCCCCC'
        border = COLOR_ACTIVE_BORDER if is_active else COLOR_INACTIVE_BORDER
        pen = PEN_WIDTH_ACTIVE if is_active else PEN_WIDTH_DEFAULT
        
        if len(label) > MAX_LABEL_TEXT_LENGTH:
            label = label[:LABEL_TRUNCATE_LEN] + "..."

        self.dot.node(nid, label, shape=shape, fillcolor=bg, color=border, fontcolor=fg, penwidth=pen, id=f"cfg_node_{start_line}")
        return nid

    def get_dot(self):
        """Finalizes the graph, connecting remaining leaves to the exit target node."""
        end_label = f"Return ({self.active_func_node.name})" if self.active_func_node else "Exit (Global)"
        end_node = self.add_node(end_label, LINE_NO_END_PLACEHOLDER, LINE_NO_END_PLACEHOLDER, shape="oval", fillcolor=COLOR_EXIT_BG)
        for leaf in self.current_nodes:
            self.dot.edge(leaf, end_node)
        return self.dot

    def visit_FunctionDef_focused(self, node):
        """Compiles statements within the function body scope."""
        self.start_node = self.add_node(f"Start: {node.name}()", node.lineno, node.lineno, shape="oval", fillcolor=COLOR_START_FUNC_BG)
        self.current_nodes = [self.start_node]
        for stmt in node.body:
            self.visit(stmt)

    def visit_Global(self, tree):
        """Compiles statements within the global file scope."""
        self.start_node = self.add_node("Start: Global Scope", 1, 1, shape="oval", fillcolor=COLOR_START_GLOBAL_BG)
        self.current_nodes = [self.start_node]
        for node in tree.body:
            self.visit(node)

    def visit_FunctionDef(self, node):
        """Visits function declarations, showing them as single collapsed definition nodes in outer scopes."""
        label = f"def {node.name}(...)"
        fn_node = self.add_node(label, node.lineno, node.lineno, shape="parallelogram", fillcolor=COLOR_FN_DECL_BG)
        for curr in self.current_nodes:
            self.dot.edge(curr, fn_node)
        self.current_nodes = [fn_node]

    def visit_Assign(self, node):
        """Visits variable assignments."""
        targets = ", ".join([ast.unparse(t) for t in node.targets])
        value = ast.unparse(node.value)
        label = f"{targets} = {value}"
        stmt_node = self.add_node(label, node.lineno, node.end_lineno or node.lineno)
        for curr in self.current_nodes:
            self.dot.edge(curr, stmt_node)
        self.current_nodes = [stmt_node]

    def visit_Expr(self, node):
        """Visits expression blocks (e.g. prints or generic function calls)."""
        label = ast.unparse(node.value)
        stmt_node = self.add_node(label, node.lineno, node.end_lineno or node.lineno)
        for curr in self.current_nodes:
            self.dot.edge(curr, stmt_node)
        self.current_nodes = [stmt_node]

    def visit_If(self, node):
        """Visits branch conditional statements, splitting the execution flowchart path."""
        test_str = ast.unparse(node.test)
        cond_node = self.add_node(f"if {test_str}", node.lineno, node.lineno, shape="diamond", fillcolor=COLOR_IF_BG)
        for curr in self.current_nodes:
            self.dot.edge(curr, cond_node)
        
        # True path evaluation
        self.current_nodes = [cond_node]
        for stmt in node.body:
            self.visit(stmt)
        true_leaves = self.current_nodes
        
        # Else path evaluation
        self.current_nodes = [cond_node]
        if node.orelse:
            for stmt in node.orelse:
                self.visit(stmt)
            false_leaves = self.current_nodes
        else:
            false_leaves = [cond_node]
            
        self.current_nodes = list(set(true_leaves + false_leaves))

    def visit_While(self, node):
        """Visits while loops, looping outputs back to the condition node."""
        test_str = ast.unparse(node.test)
        cond_node = self.add_node(f"while {test_str}", node.lineno, node.lineno, shape="diamond", fillcolor=COLOR_LOOP_BG)
        for curr in self.current_nodes:
            self.dot.edge(curr, cond_node)
            
        self.current_nodes = [cond_node]
        for stmt in node.body:
            self.visit(stmt)
            
        for leaf in self.current_nodes:
            self.dot.edge(leaf, cond_node)
            
        self.current_nodes = [cond_node]

    def visit_For(self, node):
        """Visits for loops, looping outputs back to the condition node."""
        target = ast.unparse(node.target)
        iter_str = ast.unparse(node.iter)
        cond_node = self.add_node(f"for {target} in {iter_str}", node.lineno, node.lineno, shape="diamond", fillcolor=COLOR_LOOP_BG)
        for curr in self.current_nodes:
            self.dot.edge(curr, cond_node)
            
        self.current_nodes = [cond_node]
        for stmt in node.body:
            self.visit(stmt)
            
        for leaf in self.current_nodes:
            self.dot.edge(leaf, cond_node)
            
        self.current_nodes = [cond_node]

    def visit_Return(self, node):
        """Visits function returns, terminating execution paths."""
        val = ast.unparse(node.value) if node.value else ""
        label = f"return {val}"
        ret_node = self.add_node(label, node.lineno, node.end_lineno or node.lineno, shape="parallelogram", fillcolor=COLOR_RETURN_BG)
        for curr in self.current_nodes:
            self.dot.edge(curr, ret_node)
        self.current_nodes = []
