import pandas as pd
import os

def run_draft_pipeline():
    # URL for Jack Lichtenstein's master CSV
    url = "https://raw.githubusercontent.com/JackLich10/nfl-draft-data/main/nfl_draft_prospects.csv"
    
    # Positions to screen out
    ol_positions = ['OT', 'OG', 'C', 'OL', 'G', 'LS']
    
    # Sources to include
    source_columns = {
        'espn_rank': 'ESPN',
        'pff_rank': 'PFF',
        'athletic_rank': 'Athletic',
        'nfl_rank': 'NFL.com',
        'cbs_rank': 'CBS'
    }

    try:
        print("Downloading latest draft data...")
        df = pd.read_csv(url, low_memory=False)

        # 1. Filter for 2025 and Remove OL
        df_2025 = df[(df['year'] == 2025) & (~df['pos'].isin(ol_positions))].copy()
        
        # 2. Create Industry Sources String
        def get_sources(row):
            parts = []
            for col, name in source_columns.items():
                if col in row and pd.notnull(row[col]):
                    parts.append(f"{name}:{int(row[col])}")
            return "|".join(parts)
        
        df_2025['industry_sources'] = df_2025.apply(get_sources, axis=1)

        # 3. Apply Fantasy Multipliers (Weighted Ranking)
        multipliers = {'QB': 1.0, 'RB': 1.5, 'WR': 1.4, 'TE': 1.2}
        df_2025['fantasy_rank'] = df_2025.apply(
            lambda r: round(r['consensus_rank'] / multipliers.get(r['pos'], 1.0), 2) 
            if pd.notnull(r['consensus_rank']) else 999, axis=1
        )

        # 4. Final Sorting
        df_2025 = df_2025.sort_values(by='consensus_rank', ascending=True)

        # 5. SAVE - Ensure folder exists and name is consistent
        os.makedirs('data', exist_ok=True)
        
        # DOUBLE CHECK: Make sure 'process-excel-rankings.js' uses this same name!
        output_path = 'data/prospects_test_2025.csv'
        df_2025.to_csv(output_path, index=False)
        
        print(f"✅ Success! {len(df_2025)} players exported to {output_path}")

    except Exception as e:
        print(f"❌ Error: {e}")
        exit(1) # This tells the GitHub Action to STOP if the script fails

if __name__ == "__main__":
    run_draft_pipeline()
