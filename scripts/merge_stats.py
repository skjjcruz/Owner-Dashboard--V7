import pandas as pd
import os

def run_draft_pipeline():
    url = "https://raw.githubusercontent.com/JackLich10/nfl-draft-data/main/nfl_draft_prospects.csv"
    ol_positions = ['OT', 'OG', 'C', 'OL', 'G', 'LS']
    
    # Define which sources you want to track
    source_columns = {
        'espn_rank': 'ESPN',
        'pff_rank': 'PFF',
        'athletic_rank': 'The Athletic',
        'nfl_rank': 'NFL.com',
        'cbs_rank': 'CBS'
    }

    try:
        df = pd.read_csv(url, low_memory=False)
        df_filtered = df[(df['year'] == 2025) & (~df['pos'].isin(ol_positions))].copy()

        # --- EXTRACT SOURCES ---
        def get_source_string(row):
            parts = []
            for col, name in source_columns.items():
                if col in row and pd.notnull(row[col]):
                    # Format as "Source:Rank" separated by a vertical bar
                    parts.append(f"{name}:{int(row[col])}")
            return "|".join(parts)

        df_filtered['industry_sources'] = df_filtered.apply(get_source_string, axis=1)
        # -----------------------

        # Apply your fantasy multipliers as before
        multipliers = {'QB': 1.0, 'RB': 1.5, 'WR': 1.4, 'TE': 1.2}
        df_filtered['fantasy_rank'] = df_filtered.apply(
            lambda r: round(r['consensus_rank'] / multipliers.get(r['pos'], 1.0), 2), axis=1
        )

        os.makedirs('data', exist_ok=True)
        df_filtered.to_csv('data/prospects_test_2025.csv', index=False)
        print("Success! Industry sources added.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    run_draft_pipeline()
