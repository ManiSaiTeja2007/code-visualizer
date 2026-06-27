import re
import ast

def analyze_complexity(code_str: str, language: str) -> dict:
    """
    Statically analyzes code snippet to estimate Time and Space complexity.
    Returns a dict with complexity details, explanations, and visual badges.
    """
    code_clean = code_str.strip()
    
    # Defaults
    time_comp = "O(1)"
    space_comp = "O(1)"
    has_recursion = False
    max_nesting_depth = 0
    explanation = "Sequential execution. Code runs in constant time without iteration."
    badge_color = "green" # green = O(1)/O(log N), blue = O(N), yellow = O(N log N), red = O(N^2) or worse
    
    # 1. Check for Binary Search patterns (O(log N))
    bin_search_keywords = [r"mid\s*=", r"/=\s*2", r"//=\s*2", r">>\s*1", r"binary_search", r"binarySearch"]
    is_binary_division = any(re.search(pat, code_clean) for pat in bin_search_keywords)
    
    # 2. Check for recursion (function calling itself)
    # Detect function defs and check if function name is called inside its body
    functions = []
    # Regex to catch function definitions: def func_name( or int func_name( or func func_name(
    func_def_patterns = [
        r"def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(", # Python
        r"\b(?:int|void|double|float|char\*|bool)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(", # C/C++
        r"func\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(", # Go
        r"function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(" # PHP
    ]
    
    for pat in func_def_patterns:
        matches = re.findall(pat, code_clean)
        functions.extend(matches)
        
    for func in functions:
        if func == "main":
            continue
        # Find occurrences of func() call inside code after the def
        # Check if the name appears multiple times (at least once for def and once for call inside)
        calls = len(re.findall(r"\b" + re.escape(func) + r"\s*\(", code_clean))
        if calls > 1:
            has_recursion = True
            
    # 3. Analyze loops and nesting depth
    # Python AST walker (most accurate if valid Python)
    if language == "python":
        try:
            tree = ast.parse(code_str)
            class LoopVisitor(ast.NodeVisitor):
                def __init__(self):
                    self.max_depth = 0
                    self.current_depth = 0
                    self.has_heap_alloc = False
                
                def visit_For(self, node):
                    self.current_depth += 1
                    self.max_depth = max(self.max_depth, self.current_depth)
                    self.generic_visit(node)
                    self.current_depth -= 1

                def visit_While(self, node):
                    self.current_depth += 1
                    self.max_depth = max(self.max_depth, self.current_depth)
                    self.generic_visit(node)
                    self.current_depth -= 1
                    
                def visit_ListComp(self, node):
                    self.has_heap_alloc = True
                    self.generic_visit(node)
                    
                def visit_Call(self, node):
                    # Check for append() or malloc()
                    if isinstance(node.func, ast.Attribute) and node.func.attr == "append":
                        self.has_heap_alloc = True
                    self.generic_visit(node)
            
            visitor = LoopVisitor()
            visitor.visit(tree)
            max_nesting_depth = visitor.max_depth
            if visitor.has_heap_alloc:
                space_comp = "O(N)"
        except Exception:
            # Fallback to regex analysis if AST parsing fails
            max_nesting_depth = estimate_nesting_depth_regex(code_clean)
    else:
        # For C, C++, Go, PHP, use regex indentation or brace nesting estimators
        max_nesting_depth = estimate_nesting_depth_regex(code_clean)
        
        # Check malloc/new for heap allocation (Space Complexity O(N))
        if re.search(r"\bmalloc\s*\(|\bnew\s+[a-zA-Z0-9_]+|\[\s*[Nn]\s*\]", code_clean):
            space_comp = "O(N)"

    # 4. Synthesize Complexity Estimates
    if has_recursion:
        # Check if Fibonacci-like double recursion or single recursion
        if len(re.findall(r"\b[a-zA-Z0-9_]+\s*\(.*-.*1.*\)", code_clean)) > 1:
            time_comp = "O(2^N)"
            space_comp = "O(N)"
            explanation = "Exponential complexity detected! Multiple recursive branches (e.g. Fibonacci) run at each level, causing call stack to grow linearly O(N) and computation to double."
            badge_color = "red"
        else:
            time_comp = "O(N)"
            space_comp = "O(N)"
            explanation = "Linear complexity. Code relies on a single recursive path. The auxiliary space is O(N) due to call stack frames."
            badge_color = "blue"
    elif max_nesting_depth == 1:
        if is_binary_division:
            time_comp = "O(log N)"
            explanation = "Logarithmic complexity. The search space is divided in half at each iteration (like Binary Search)."
            badge_color = "green"
        else:
            time_comp = "O(N)"
            explanation = "Linear complexity. Contains a single loop that iterates over N elements sequentially."
            badge_color = "blue"
    elif max_nesting_depth == 2:
        time_comp = "O(N^2)"
        explanation = "Quadratic complexity. A nested loop iterates N times inside another N-iteration loop. Typically executes N*N operations."
        badge_color = "red"
    elif max_nesting_depth >= 3:
        time_comp = f"O(N^{max_nesting_depth})"
        explanation = f"Polynomial complexity O(N^{max_nesting_depth}). Deeply nested loops detected. Highly inefficient for large inputs."
        badge_color = "red"
    elif is_binary_division:
        time_comp = "O(log N)"
        explanation = "Logarithmic time complexity. Performs binary division splits."
        badge_color = "green"
        
    return {
        "time_complexity": time_comp,
        "space_complexity": space_comp,
        "has_recursion": has_recursion,
        "nesting_depth": max_nesting_depth,
        "explanation": explanation,
        "badge_color": badge_color
    }

def estimate_nesting_depth_regex(code: str) -> int:
    """
    Estimates loop nesting depth by analyzing block levels.
    """
    lines = code.split('\n')
    max_depth = 0
    current_depth = 0
    
    # Track opening/closing brackets for loops
    # A simple indicator is finding a loop keyword and then tracking active loops
    # We can inspect lines containing loop keywords and check their relative indentation levels!
    loop_indents = []
    
    loop_pat = re.compile(r"\b(for|while|foreach)\b")
    
    for line in lines:
        if not line.strip() or line.strip().startswith("//") or line.strip().startswith("#"):
            continue
            
        indent = len(line) - len(line.lstrip())
        
        # Remove any loop indents that are outer to this line
        loop_indents = [ind for ind in loop_indents if ind < indent]
        
        if loop_pat.search(line):
            loop_indents.append(indent)
            max_depth = max(max_depth, len(loop_indents))
            
    return max_depth
