import sqlite3
import sqlglot
import random
from faker import Faker

fake = Faker()

def generate_fake_data_for_column(col_name: str, col_type: str):
    """
    Heuristics to generate fake data based on column name and type.
    """
    col_name = col_name.lower()
    col_type = col_type.lower()
    
    # ID / Primary Key
    if 'id' in col_name:
        return None # We will handle sequential IDs later if needed, or random ints
        
    if 'first_name' in col_name:
        return fake.first_name()
    if 'last_name' in col_name:
        return fake.last_name()
    if 'name' in col_name:
        return fake.name()
    if 'email' in col_name:
        return fake.email()
    if 'date' in col_name or 'time' in col_name:
        if 'year' in col_name:
            return str(fake.year())
        return fake.date_between(start_date='-5y', end_date='today').isoformat()
    if 'salary' in col_name or 'price' in col_name or 'amount' in col_name:
        return round(random.uniform(30000, 150000), 2)
    if 'role' in col_name or 'title' in col_name:
        return fake.job()
    if 'phone' in col_name:
        return fake.phone_number()
    if 'address' in col_name or 'city' in col_name:
        return fake.city()

    # Fallback to types
    if 'int' in col_type:
        return random.randint(1, 100)
    if 'float' in col_type or 'decimal' in col_type or 'numeric' in col_type:
        return round(random.uniform(1, 1000), 2)
    if 'bool' in col_type:
        return random.choice([True, False])
    if 'date' in col_type:
        return fake.date()
    
    return fake.word()

def execute_synthetic_sql(script: str):
    """
    Executes a SQL script. 
    Intercepts CREATE TABLE to auto-populate with synthetic data.
    Captures SELECT results.
    """
    conn = sqlite3.connect(':memory:')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    logs = []
    results = None
    created_tables = []
    execution_plan = []
    
    try:
        # We can split script by ';' for simple execution
        # But using sqlglot allows us to safely parse statements
        statements = sqlglot.parse(script)
        
        for stmt in statements:
            if not stmt:
                continue
                
            stmt_sql = stmt.sql(dialect="sqlite")
            
            # 1. Execute the statement
            try:
                cursor.execute(stmt_sql)
            except Exception as e:
                logs.append(f"ERROR executing '{stmt_sql[:50]}...': {str(e)}")
                raise Exception(f"SQL Error: {str(e)}")

            # 2. If it was a CREATE TABLE, generate mock data
            if isinstance(stmt, sqlglot.exp.Create) and stmt.args.get("kind") == "TABLE":
                table_name = stmt.this.this.name if hasattr(stmt.this, 'this') else stmt.this.name
                created_tables.append(table_name)
                logs.append(f"Created table '{table_name}'. Generating mock data...")
                
                # Fetch schema from sqlite
                cursor.execute(f"PRAGMA table_info({table_name})")
                columns = cursor.fetchall()
                if not columns:
                    continue
                
                # Generate 15 mock rows
                for i in range(1, 16):
                    row_data = []
                    col_names = []
                    for col in columns:
                        c_name = col['name']
                        c_type = col['type']
                        is_pk = col['pk']
                        
                        col_names.append(c_name)
                        if is_pk:
                            row_data.append(i) # sequential ID
                        else:
                            val = generate_fake_data_for_column(c_name, c_type)
                            if val is None:
                                val = i
                            row_data.append(val)
                            
                    # Insert the row
                    placeholders = ",".join(["?"] * len(row_data))
                    insert_sql = f"INSERT INTO {table_name} ({','.join(col_names)}) VALUES ({placeholders})"
                    cursor.execute(insert_sql, row_data)
                    
                conn.commit()
                logs.append(f"Inserted 15 synthetic rows into '{table_name}'.")

            # 3. If it's a SELECT, capture the result and build the execution plan
            if isinstance(stmt, sqlglot.exp.Select):
                # Build a dynamic execution plan based on the AST clauses
                if stmt.args.get('from'):
                    from_tbl = stmt.args['from'].this.name if hasattr(stmt.args['from'].this, 'name') else str(stmt.args['from'].this)
                    execution_plan.append({"phase": "FROM", "description": f"Loading source table: {from_tbl}"})
                
                if stmt.args.get('joins'):
                    for j in stmt.args['joins']:
                        join_tbl = j.this.name if hasattr(j.this, 'name') else str(j.this)
                        execution_plan.append({"phase": "JOIN", "description": f"Joining table: {join_tbl}"})
                
                if stmt.args.get('where'):
                    execution_plan.append({"phase": "WHERE", "description": f"Applying filters: {stmt.args['where'].this.sql(dialect='sqlite')}"})
                    
                if stmt.args.get('group'):
                    execution_plan.append({"phase": "GROUP BY", "description": "Grouping aggregated rows"})
                    
                if stmt.args.get('order'):
                    execution_plan.append({"phase": "ORDER BY", "description": "Sorting the result set"})
                    
                execution_plan.append({"phase": "SELECT", "description": "Projecting the requested columns to build the final result"})
                
                rows = cursor.fetchall()
                if rows:
                    results = [dict(row) for row in rows]
                    logs.append(f"Executed SELECT query. Returned {len(results)} rows.")
                else:
                    results = []
                    logs.append(f"Executed SELECT query. Returned 0 rows.")

        # If there were no explicit CREATE TABLE statements, maybe they just passed a SELECT.
        # We could try to auto-mock, but for now we rely on the user providing CREATE TABLE as requested.
        # Or if we want to be robust, we can check if table exists and if not, auto-mock.
        # For this scope, since the user provided the schemas, we will handle that.

        # Let's also fetch the mock tables so the UI can display them!
        mock_databases = {}
        for table in created_tables:
            cursor.execute(f"SELECT * FROM {table} LIMIT 10")
            mock_databases[table] = [dict(r) for r in cursor.fetchall()]

        return {
            "success": True,
            "logs": logs,
            "results": results,
            "mock_databases": mock_databases,
            "execution_plan": execution_plan
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "logs": logs
        }
    finally:
        conn.close()
