import streamlit as st
import pandas as pd

# Define some mock datasets for the SQL lesson
USERS_DATA = [
    {"user_id": 1, "name": "Alice", "country": "USA"},
    {"user_id": 2, "name": "Bob", "country": "UK"},
    {"user_id": 3, "name": "Charlie", "country": "USA"},
    {"user_id": 4, "name": "David", "country": "Germany"},
    {"user_id": 5, "name": "Eve", "country": "USA"},
]

ORDERS_DATA = [
    {"order_id": 101, "user_id": 1, "total": 150},
    {"order_id": 102, "user_id": 1, "total": 50},
    {"order_id": 103, "user_id": 2, "total": 200},
    {"order_id": 104, "user_id": 3, "total": 120},
    {"order_id": 105, "user_id": 3, "total": 300},
    {"order_id": 106, "user_id": 9, "total": 80}, # User 9 doesn't exist
]

# We will define the execution frames for:
# SELECT users.name, orders.total FROM users JOIN orders ON users.user_id = orders.user_id WHERE orders.total > 100

SQL_ORDER_STEPS = [
    {
        "phase": "FROM",
        "description": "The database engine starts by loading the source tables defined in the FROM clause. It gathers the raw records of 'users' (5 rows) and 'orders' (6 rows). It does NOT start at SELECT!",
        "users_highlight": list(range(5)),
        "orders_highlight": list(range(6)),
        "intermediate_title": "Raw Input Datasets",
        "intermediate_data": {
            "users": USERS_DATA,
            "orders": ORDERS_DATA
        }
    },
    {
        "phase": "JOIN / ON",
        "description": "Next, the JOIN clause executes. It evaluates the ON condition (users.user_id = orders.user_id). Only matching pairs are kept. Note that Order 106 (user_id 9) and User 4 & 5 (no orders) are filtered out. Resulting dataset has 5 joined rows.",
        "users_highlight": [0, 1, 2],
        "orders_highlight": [0, 1, 2, 3, 4],
        "intermediate_title": "Joined Rows (ON users.user_id = orders.user_id)",
        "intermediate_data": [
            {"user_id": 1, "name": "Alice", "order_id": 101, "total": 150},
            {"user_id": 1, "name": "Alice", "order_id": 102, "total": 50},
            {"user_id": 2, "name": "Bob", "order_id": 103, "total": 200},
            {"user_id": 3, "name": "Charlie", "order_id": 104, "total": 120},
            {"user_id": 3, "name": "Charlie", "order_id": 105, "total": 300},
        ]
    },
    {
        "phase": "WHERE",
        "description": "The WHERE clause is now applied to filter rows. It evaluates 'orders.total > 100'. Out of 5 joined rows, Bob's order 102 (total 50) is eliminated. The dataset shrinks to 4 rows.",
        "users_highlight": [0, 1, 2],
        "orders_highlight": [0, 2, 3, 4],
        "intermediate_title": "Filtered Joined Rows (WHERE total > 100)",
        "intermediate_data": [
            {"user_id": 1, "name": "Alice", "order_id": 101, "total": 150},
            {"user_id": 2, "name": "Bob", "order_id": 103, "total": 200},
            {"user_id": 3, "name": "Charlie", "order_id": 104, "total": 120},
            {"user_id": 3, "name": "Charlie", "order_id": 105, "total": 300},
        ]
    },
    {
        "phase": "SELECT",
        "description": "Finally, the SELECT clause executes! It projects only the requested columns (name, total) and prepares the output. Only now are the user_id and country columns discarded.",
        "users_highlight": [0, 1, 2],
        "orders_highlight": [0, 2, 3, 4],
        "intermediate_title": "Final Result (SELECT name, total)",
        "intermediate_data": [
            {"name": "Alice", "total": 150},
            {"name": "Bob", "total": 200},
            {"name": "Charlie", "total": 120},
            {"name": "Charlie", "total": 300},
        ]
    }
]

# We will define the frames for Optimization Comparison:
# Query A: (Unoptimized) SELECT * FROM users JOIN orders ON users.user_id = orders.user_id WHERE users.country = 'USA'
# Query B: (Optimized) SELECT * FROM (SELECT * FROM users WHERE country = 'USA') u JOIN orders ON u.user_id = orders.user_id

SQL_OPTIMIZATION_STEPS = [
    {
        "step": 1,
        "description": "Query A (No Pushdown) joins entire tables first, creating a cartesian comparison of 5 users x 6 orders = 30 evaluations, resulting in 5 joined rows. Query B (Filter First) pre-filters users from 'USA' first (reduces 5 users to 3: Alice, Charlie, Eve).",
        "query_a_title": "Query A (Join Then Filter)",
        "query_a_data": "Evaluating 30 Cartesian matches...",
        "query_b_title": "Query B (Filter Then Join)",
        "query_b_data": "Filtered Users Table (USA only): Alice, Charlie, Eve (3 rows)"
    },
    {
        "step": 2,
        "description": "Query A now filters the 5 joined rows using WHERE country='USA', outputting 4 rows. Query B joins the pre-filtered table (3 rows) with orders (6 rows), requiring only 18 comparisons and outputting the same 4 rows. Filtering first reduces comparisons by 40%!",
        "query_a_title": "Query A Output (WHERE country = 'USA')",
        "query_a_data": [
            {"name": "Alice", "order_id": 101, "country": "USA", "total": 150},
            {"name": "Alice", "order_id": 102, "country": "USA", "total": 50},
            {"name": "Charlie", "order_id": 104, "country": "USA", "total": 120},
            {"name": "Charlie", "order_id": 105, "country": "USA", "total": 300},
        ],
        "query_b_title": "Query B Output (Join on Filtered)",
        "query_b_data": [
            {"name": "Alice", "order_id": 101, "country": "USA", "total": 150},
            {"name": "Alice", "order_id": 102, "country": "USA", "total": 50},
            {"name": "Charlie", "order_id": 104, "country": "USA", "total": 120},
            {"name": "Charlie", "order_id": 105, "country": "USA", "total": 300},
        ]
    }
]

def render_sql_pipeline_view(step_idx):
    step = SQL_ORDER_STEPS[step_idx]
    
    # Progress visualization bar
    phases = ["FROM", "JOIN / ON", "WHERE", "SELECT"]
    
    cols = st.columns(4)
    for idx, p in enumerate(phases):
        with cols[idx]:
            if p == step["phase"]:
                st.markdown(f'<div style="background-color:#00FF66; color:#0F0F1A; text-align:center; padding:10px; border-radius:5px; font-weight:bold; border: 2px solid #00E676; box-shadow: 0 0 10px rgba(0,255,102,0.5);">{p}</div>', unsafe_allow_html=True)
            else:
                st.markdown(f'<div style="background-color:#1A1A2E; color:#94A3B8; text-align:center; padding:10px; border-radius:5px; border: 1px solid #333355;">{p}</div>', unsafe_allow_html=True)
                
    st.write("")
    st.info(step["description"])
    
    # Render source tables vs intermediate result
    st.subheader(step["intermediate_title"])
    
    data = step["intermediate_data"]
    if isinstance(data, dict):
        col1, col2 = st.columns(2)
        with col1:
            st.markdown("**Table: users**")
            df_users = pd.DataFrame(USERS_DATA)
            # Apply styling to highlight active rows
            highlight = step.get("users_highlight", [])
            
            def highlight_rows_users(row):
                return ['background-color: #2E2E4A; color: #FFFFFF' if row.name in highlight else '' for _ in row]
            
            st.dataframe(df_users.style.apply(highlight_rows_users, axis=1), width='stretch')
            
        with col2:
            st.markdown("**Table: orders**")
            df_orders = pd.DataFrame(ORDERS_DATA)
            highlight = step.get("orders_highlight", [])
            
            def highlight_rows_orders(row):
                return ['background-color: #2E2E4A; color: #FFFFFF' if row.name in highlight else '' for _ in row]
                
            st.dataframe(df_orders.style.apply(highlight_rows_orders, axis=1), width='stretch')
    else:
        df_res = pd.DataFrame(data)
        st.dataframe(df_res, width='stretch')


def render_sql_optimizer_view(step_idx):
    step = SQL_OPTIMIZATION_STEPS[step_idx]
    st.info(step["description"])
    
    col1, col2 = st.columns(2)
    with col1:
        st.subheader(step["query_a_title"])
        data_a = step["query_a_data"]
        if isinstance(data_a, str):
            st.warning(data_a)
        else:
            st.dataframe(pd.DataFrame(data_a), width='stretch')
            
    with col2:
        st.subheader(step["query_b_title"])
        data_b = step["query_b_data"]
        if isinstance(data_b, str):
            st.success(data_b)
        else:
            st.dataframe(pd.DataFrame(data_b), width='stretch')
