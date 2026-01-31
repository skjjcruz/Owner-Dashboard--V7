import pandas as pd
import os

def run_draft_pipeline():
    # URL for Jack Lichtenstein's master CSV (13,000+ rows historical)
    url = "https://raw.githubusercontent.com/JackLich10/nfl-draft-data/main/nfl_draft_prospects.csv"
    
    # Positions to screen out
    ol_positions = ['OT', 'OG', 'C', 'OL', 'G', 'LS']
    
    # Sources to include in the "Industry Rankings" view
    source_columns = {
        'espn_rank': 'ESPN',
        'pff_rank': 'PFF',
        'athletic_rank': 'Athletic',
        'nfl_rank': 'NFL.com',
        'cbs_rank': 'CBS'
    }

    try:
        print("Downloading Jack's full database...")
        df = pd.read_csv(url, low_memory=False)

        # Filter for 2025 and Screen OL - No .head() or limits here!
        df_2025 = df[(df['year'] == 2025) & (~df['pos'].isin(ol_positions))].copy()
        
        # --- Create Industry Sources String ---
        def get_sources(row):
            parts = []
            for col, name in source_columns.items():
                if col in row and pd.notnull(row[col]):
                    parts.append(f"{name}:{int(row[col])}")
            return "|".join(parts)
        
        df_2025['industry_sources'] = df_2025.apply(get_sources, axis=1)

        # --- Apply Fantasy Multipliers ---
        multipliers = {'QB': 1.0, 'RB': 1.5, 'WR': 1.4, 'TE': 1.2}
        df_2025['fantasy_rank'] = df_2025.apply(
            lambda r: round(r['consensus_rank'] / multipliers.get(r['pos'], 1.0), 2), axis=1
        )

        # Sort by consensus so the big names are at the top
        df_2025 = df_2025.sort_values(by='consensus_rank', ascending=True)

        # Save to your repository
        os.makedirs('data', exist_ok=True)
        df_2025.to_csv('data/prospects_test_2025.csv', index=False)
        
        print(f"Success! {len(df_2025)} players exported to prospects_test_2025.csv")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    run_draft_pipeline()

