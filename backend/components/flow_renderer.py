import ast
import graphviz

class FlowRenderer:
    def __init__(self, code_str, active_line=None):
        self.code_str = code_str
        self.active_line = active_line

    def generate_dot(self):
        # Create Graphviz digraph with a premium dark layout
        dot = graphviz.Digraph(comment="Control Flow Graph")
        dot.attr(bgcolor="#0F0F1A")
        dot.attr('node', 
                 fontname='Courier New, JetBrains Mono', 
                 style='filled,rounded', 
                 shape='box',
                 fillcolor='#1A1A2E', 
                 color='#333355', 
                 fontcolor='#CCCCCC',
                 penwidth='1.5')
        dot.attr('edge', 
                 fontname='Courier New, JetBrains Mono',
                 color='#444466', 
                 fontcolor='#8888AA',
                 arrowsize='0.8',
                 penwidth='1.2')

        try:
            tree = ast.parse(self.code_str)
        except Exception:
            # Code is not Python or AST parse failed. Apply Local Windowing fallback!
            lines = self.code_str.strip().split('\n')
            total_lines = len(lines)
            
            # Local window: active_line +/- 3 lines (max 8 nodes)
            if total_lines > 12 and self.active_line is not None:
                start_win = max(1, self.active_line - 3)
                end_win = min(total_lines, self.active_line + 4)
            else:
                start_win = 1
                end_win = total_lines
                
            prev_id = None
            if start_win > 1:
                # Add a collapsed starter node
                dot.node("win_start", "... (outer scope) ...", fillcolor="#0F0F1A", color="#444466", fontcolor="#666688", shape="ellipse")
                prev_id = "win_start"
                
            for idx in range(start_win - 1, end_win):
                line_no = idx + 1
                line = lines[idx]
                label = f"Line {line_no}: {line.strip()[:35]}"
                is_active = (self.active_line == line_no)
                
                node_id = f"line_{line_no}"
                bg = '#FF3366' if is_active else '#1A1A2E' # Soft red for active, dark blue for inactive
                fg = '#FFFFFF' if is_active else '#CCCCCC'
                border = '#FF3366' if is_active else '#333355'
                pen = '3.0' if is_active else '1.5'
                
                dot.node(node_id, label, fillcolor=bg, color=border, fontcolor=fg, penwidth=pen, id=f"cfg_node_{line_no}")
                if prev_id:
                    dot.edge(prev_id, node_id)
                prev_id = node_id
                
            if end_win < total_lines:
                dot.node("win_end", "... (outer scope) ...", fillcolor="#0F0F1A", color="#444466", fontcolor="#666688", shape="ellipse")
                if prev_id:
                    dot.edge(prev_id, "win_end")
            return dot

        # Find if active line lies inside a function definition (for scope-focused rendering)
        active_func_node = None
        if self.active_line is not None:
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef):
                    if node.lineno <= self.active_line <= (node.end_lineno or node.lineno):
                        # Narrowest function block
                        if active_func_node is None or (node.end_lineno - node.lineno < active_func_node.end_lineno - active_func_node.lineno):
                            active_func_node = node

        # Walk AST to construct focused blocks
        builder = CFGBuilder(self.active_line, active_func_node)
        if active_func_node:
            # Only build flow for the active function scope
            builder.visit_FunctionDef_focused(active_func_node)
        else:
            # Build flow for global scope only (functions remain collapsed)
            builder.visit_Global(tree)
        return builder.get_dot()

    def generate_all_scopes_svg(self) -> dict:
        scopes = {}
        try:
            tree = ast.parse(self.code_str)
        except Exception:
            # Fallback to single local windowing graph
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
    def __init__(self, active_line, active_func_node=None):
        self.dot = graphviz.Digraph(comment="CFG")
        self.dot.attr(bgcolor="#0F0F1A")
        self.dot.attr('node', 
                      fontname='Courier New, JetBrains Mono', 
                      style='filled,rounded', 
                      shape='box',
                      fillcolor='#1A1A2E', 
                      color='#333355', 
                      fontcolor='#CCCCCC',
                      penwidth='1.5')
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
        self.node_id_counter += 1
        return f"n_{self.node_id_counter}"

    def add_node(self, label, start_line, end_line, shape="box", fillcolor=None):
        nid = self.next_id()
        is_active = False
        if self.active_line is not None and start_line <= self.active_line <= end_line:
            is_active = True

        bg = '#FF3366' if is_active else (fillcolor or '#1A1A2E')
        fg = '#FFFFFF' if is_active else '#CCCCCC'
        border = '#FF3366' if is_active else '#333355'
        pen = '3.0' if is_active else '1.5'
        
        if len(label) > 40:
            label = label[:37] + "..."

        self.dot.node(nid, label, shape=shape, fillcolor=bg, color=border, fontcolor=fg, penwidth=pen, id=f"cfg_node_{start_line}")
        return nid

    def get_dot(self):
        # Add end node and connect remaining leaves
        end_label = f"Return ({self.active_func_node.name})" if self.active_func_node else "Exit (Global)"
        end_node = self.add_node(end_label, 999999, 999999, shape="oval", fillcolor="#2E1A47")
        for leaf in self.current_nodes:
            self.dot.edge(leaf, end_node)
        return self.dot

    def visit_FunctionDef_focused(self, node):
        # Enter focused scope
        self.start_node = self.add_node(f"Start: {node.name}()", node.lineno, node.lineno, shape="oval", fillcolor="#1A2E3B")
        self.current_nodes = [self.start_node]
        
        # Traverse statements inside the function body
        for stmt in node.body:
            self.visit(stmt)

    def visit_Global(self, tree):
        # Enter global scope
        self.start_node = self.add_node("Start: Global Scope", 1, 1, shape="oval", fillcolor="#2E1A47")
        self.current_nodes = [self.start_node]
        
        # Traverse top-level statements only
        for node in tree.body:
            self.visit(node)

    def visit_FunctionDef(self, node):
        # In global/outer scope mode, show function definitions as a single collapsed node
        label = f"def {node.name}(...)"
        fn_node = self.add_node(label, node.lineno, node.lineno, shape="parallelogram", fillcolor="#1C2E2A")
        for curr in self.current_nodes:
            self.dot.edge(curr, fn_node)
        self.current_nodes = [fn_node]

    def visit_Assign(self, node):
        targets = ", ".join([ast.unparse(t) for t in node.targets])
        value = ast.unparse(node.value)
        label = f"{targets} = {value}"
        stmt_node = self.add_node(label, node.lineno, node.end_lineno or node.lineno)
        for curr in self.current_nodes:
            self.dot.edge(curr, stmt_node)
        self.current_nodes = [stmt_node]

    def visit_Expr(self, node):
        label = ast.unparse(node.value)
        stmt_node = self.add_node(label, node.lineno, node.end_lineno or node.lineno)
        for curr in self.current_nodes:
            self.dot.edge(curr, stmt_node)
        self.current_nodes = [stmt_node]

    def visit_If(self, node):
        test_str = ast.unparse(node.test)
        cond_node = self.add_node(f"if {test_str}", node.lineno, node.lineno, shape="diamond", fillcolor="#332211")
        for curr in self.current_nodes:
            self.dot.edge(curr, cond_node)
        
        # Process True branch
        self.current_nodes = [cond_node]
        for stmt in node.body:
            self.visit(stmt)
        true_leaves = self.current_nodes
        
        # Process False branch
        self.current_nodes = [cond_node]
        if node.orelse:
            for stmt in node.orelse:
                self.visit(stmt)
            false_leaves = self.current_nodes
        else:
            false_leaves = [cond_node]
            
        self.current_nodes = list(set(true_leaves + false_leaves))

    def visit_While(self, node):
        test_str = ast.unparse(node.test)
        cond_node = self.add_node(f"while {test_str}", node.lineno, node.lineno, shape="diamond", fillcolor="#331122")
        for curr in self.current_nodes:
            self.dot.edge(curr, cond_node)
            
        self.current_nodes = [cond_node]
        for stmt in node.body:
            self.visit(stmt)
            
        # Loop back to condition
        for leaf in self.current_nodes:
            self.dot.edge(leaf, cond_node)
            
        # Flow exits condition when False
        self.current_nodes = [cond_node]

    def visit_For(self, node):
        target = ast.unparse(node.target)
        iter_str = ast.unparse(node.iter)
        cond_node = self.add_node(f"for {target} in {iter_str}", node.lineno, node.lineno, shape="diamond", fillcolor="#331122")
        for curr in self.current_nodes:
            self.dot.edge(curr, cond_node)
            
        self.current_nodes = [cond_node]
        for stmt in node.body:
            self.visit(stmt)
            
        # Loop back to condition
        for leaf in self.current_nodes:
            self.dot.edge(leaf, cond_node)
            
        # Flow exits condition when done
        self.current_nodes = [cond_node]

    def visit_Return(self, node):
        val = ast.unparse(node.value) if node.value else ""
        label = f"return {val}"
        ret_node = self.add_node(label, node.lineno, node.end_lineno or node.lineno, shape="parallelogram", fillcolor="#2E1A24")
        for curr in self.current_nodes:
            self.dot.edge(curr, ret_node)
        self.current_nodes = []
