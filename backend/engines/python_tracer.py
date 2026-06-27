import sys
import io
import traceback

class CodeTracer:
    def __init__(self, max_steps=500):
        self.steps = []
        self.stdout_buf = io.StringIO()
        self.original_stdout = sys.stdout
        self.max_steps = max_steps

    def trace_func(self, frame, event, arg):
        if frame.f_code.co_filename != "<string>":
            return self.trace_func

        if len(self.steps) >= self.max_steps:
            raise RuntimeError(f"Execution step limit of {self.max_steps} exceeded. Possible infinite loop detected.")

        if event in ("line", "call", "return", "exception"):
            # Capture local variables safely
            local_vars = {}
            for k, v in frame.f_locals.items():
                if not k.startswith("__"):
                    try:
                        # Avoid rendering extremely long lists/strings
                        val_str = repr(v)
                        if len(val_str) > 100:
                            val_str = val_str[:97] + "..."
                        local_vars[k] = val_str
                    except Exception:
                        local_vars[k] = "<unserializable>"

            # Capture call stack
            stack = []
            curr_frame = frame
            while curr_frame:
                if curr_frame.f_code.co_filename == "<string>":
                    stack.append(curr_frame.f_code.co_name)
                curr_frame = curr_frame.f_back
            stack.reverse()

            stdout_val = self.stdout_buf.getvalue()

            step_info = {
                "line": frame.f_lineno,
                "event": event,
                "locals": local_vars,
                "stack": stack,
                "stdout": stdout_val,
                "status": "running"
            }
            
            if event == "exception":
                step_info["status"] = "crash"
                step_info["error"] = f"{arg[0].__name__}: {arg[1]}"

            self.steps.append(step_info)
        return self.trace_func

    def run(self, code_str, language="python"):
        if language != "python":
            return GenericLexicalSimulator(self.max_steps).run(code_str)
            
        try:
            compiled_code = compile(code_str, "<string>", "exec")
        except SyntaxError as e:
            return [{
                "line": e.lineno or 1,
                "event": "exception",
                "locals": {},
                "stack": [],
                "stdout": "",
                "status": "crash",
                "error": f"SyntaxError: {e.msg} at line {e.lineno}"
            }]

        sys.stdout = self.stdout_buf
        global_env = {"__name__": "__main__"}
        # Pre-populate some standard library modules if desired, or keep it clean
        
        sys.settrace(self.trace_func)
        try:
            exec(compiled_code, global_env)
        except RuntimeError as re:
            if "Execution step limit" in str(re):
                self.steps.append({
                    "line": self.steps[-1]["line"] if self.steps else 1,
                    "event": "exception",
                    "locals": {},
                    "stack": [],
                    "stdout": self.stdout_buf.getvalue(),
                    "status": "crash",
                    "error": f"RuntimeError: {str(re)}"
                })
            else:
                if not self.steps or self.steps[-1]["status"] != "crash":
                    self.steps.append({
                        "line": self.steps[-1]["line"] if self.steps else 1,
                        "event": "exception",
                        "locals": {},
                        "stack": [],
                        "stdout": self.stdout_buf.getvalue(),
                        "status": "crash",
                        "error": f"RuntimeError: {str(re)}"
                    })
        except Exception as e:
            if not self.steps or self.steps[-1]["status"] != "crash":
                self.steps.append({
                    "line": self.steps[-1]["line"] if self.steps else 1,
                    "event": "exception",
                    "locals": {},
                    "stack": [],
                    "stdout": self.stdout_buf.getvalue(),
                    "status": "crash",
                    "error": f"{type(e).__name__}: {str(e)}"
                })
        finally:
            sys.settrace(None)
            sys.stdout = self.original_stdout

        return self.steps

import re

class GenericLexicalSimulator:
    def __init__(self, max_steps=500):
        self.max_steps = max_steps

    def run(self, code_str):
        lines = code_str.split('\n')
        steps = []
        local_vars = {}
        stdout_lines = []
        
        idx = 0
        loop_stack = [] # Stack of dict: {line_idx, var, max, curr}
        step_count = 0
        
        while idx < len(lines):
            step_count += 1
            if step_count >= self.max_steps:
                steps.append({
                    "line": idx + 1,
                    "event": "exception",
                    "locals": dict(local_vars),
                    "stack": ["main"],
                    "stdout": "\n".join(stdout_lines),
                    "status": "crash",
                    "error": f"RuntimeError: Execution step limit of {self.max_steps} exceeded. Possible infinite loop detected."
                })
                break
                
            line = lines[idx].strip()
            line_no = idx + 1
            
            # Skip empty lines or sheer braces/comments
            if not line or line.startswith("//") or line.startswith("#") or line == "{" or line == "}":
                # Record a sequential line step without state change
                steps.append({
                    "line": line_no,
                    "event": "line",
                    "locals": dict(local_vars),
                    "stack": ["main"],
                    "stdout": "\n".join(stdout_lines),
                    "status": "running"
                })
                idx += 1
                continue

            # Check loop header: e.g. for (int i = 0; i < 3; i++) or for i := 0; i < 3; i++ or for i in range(3): or while (i < 3)
            loop_match = re.search(r"\bfor\b\s*\(?\s*(?:int|var|let)?\s*([a-zA-Z_]\w*)\s*(?:=|:=)\s*\d+\s*;\s*\1\s*(?:<|<=)\s*(\d+|\w+)", line)
            if not loop_match:
                loop_match = re.search(r"\bfor\b\s+([a-zA-Z_]\w*)\s+in\s+range\s*\(\s*(?:\d+\s*,\s*)?(\d+|\w+)\s*(?:\+\s*\d+)?\s*\)", line)
            if not loop_match:
                loop_match = re.search(r"\bfor\b\s*\(?\s*(?:int|var|let)?\s*([a-zA-Z_]\w*)\s*(?:=|:=|in)\s*(\d+|\w+)", line)
            
            if loop_match:
                var_name = loop_match.group(1)
                limit = loop_match.group(2)
                try:
                    max_iter = int(limit)
                except ValueError:
                    max_iter = 3 # Default loop limit for symbols
                
                # Check if this loop is already initialized
                is_initialized = any(l["line_idx"] == idx for l in loop_stack)
                if not is_initialized:
                    local_vars[var_name] = "0"
                    loop_stack.append({
                        "line_idx": idx,
                        "var": var_name,
                        "max": max_iter,
                        "curr": 0
                    })

            # Check assignments: e.g. x = 5; int x = 5; $x = 5; x := 5; x = x + 1;
            assign_match = re.search(r"^\s*(?:int|double|float|char|var|let|string)?\s*\*?\s*\$?([a-zA-Z_]\w*)\s*(?:=|:=|\+=|\*=)\s*(.+);?$", line)
            if assign_match:
                var_name = assign_match.group(1)
                value_expr = assign_match.group(2).rstrip(';').strip()
                value_expr = value_expr.strip("'\"")
                
                # Simple evaluation helper
                evaluated = value_expr
                for k, v in local_vars.items():
                    evaluated = evaluated.replace(k, str(v))
                
                # Strip out common C/C++ cast symbols if any
                evaluated = re.sub(r"\b(?:int|double|float)\b", "", evaluated)
                
                try:
                    # Arithmetic evaluator
                    if re.match(r"^[\d\s\+\-\*\/\(\)]+$", evaluated):
                        local_vars[var_name] = str(eval(evaluated))
                    else:
                        local_vars[var_name] = value_expr
                except Exception:
                    local_vars[var_name] = value_expr

            # Check output: print(x), printf(x), std::cout << x, echo x
            print_match = re.search(r"\b(?:print|printf|echo|cout\s*<<)\s*\b\(?([^;]+)\)?", line)
            if print_match:
                print_expr = print_match.group(1).rstrip(';').strip()
                # Variable replacement
                for k, v in local_vars.items():
                    print_expr = print_expr.replace(k, str(v))
                # Cleanup output text
                print_expr = print_expr.strip("'\" <<endl;\\n")
                stdout_lines.append(print_expr)

            # Record step frame
            steps.append({
                "line": line_no,
                "event": "line",
                "locals": dict(local_vars),
                "stack": ["main"],
                "stdout": "\n".join(stdout_lines),
                "status": "running"
            })

            # Handle loop bounds
            if loop_stack:
                loop = loop_stack[-1]
                
                # Check if we are at the end of this loop body
                is_end_of_loop = False
                if idx + 1 < len(lines):
                    next_line = lines[idx + 1]
                    next_indent = len(next_line) - len(next_line.lstrip())
                    loop_indent = len(lines[loop["line_idx"]]) - len(lines[loop["line_idx"]].lstrip())
                    
                    # Brace check or Indent check
                    if next_line.strip() == "}" or (next_line.strip() and next_indent <= loop_indent):
                        is_end_of_loop = True
                else:
                    is_end_of_loop = True
                
                if is_end_of_loop:
                    loop["curr"] += 1
                    if loop["curr"] < loop["max"]:
                        local_vars[loop["var"]] = str(loop["curr"])
                        idx = loop["line_idx"] # Jump back
                        continue
                    else:
                        loop_stack.pop() # Pop loop when done

            idx += 1

        # If no steps were recorded, add an empty placeholder step
        if not steps:
            steps.append({
                "line": 1,
                "event": "line",
                "locals": {},
                "stack": ["main"],
                "stdout": "",
                "status": "running"
            })
            
        return steps
