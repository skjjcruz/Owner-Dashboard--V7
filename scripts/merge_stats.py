import pandas as pd
import os
import sys

def run_draft_pipeline():
    url = "https://raw.githubusercontent.com/JackLich10/nfl-draft-data/main/nfl_draft_prospects.csv"
    
    try:
        print("Downloading latest draft data...")
        df = pd.read_csv(url, low_memory=False)

        # 1. SMART COLUMN LOCATOR
        # This looks for the right column name even if it changes slightly
        pos_col = next((c for c in ['pos', 'position', 'Pos', 'Position'] if c in df.columns), None)
        rank_col = next((c for c in ['consensus_rank', 'rank', 'Rank'] if c in df.columns), None)
        year_col = next((c for c in ['year', 'season', 'Year', 'Season'] if c in df.columns), None)
        
        if not pos_col:
            print(f"Current columns available: {df.columns.tolist()}")
            raise KeyError("Could not find a 'Position' column in the source data.")

        # 2. FILTERING (2025 Prospects, No Offensive Linemen)
        ol_positions = ['OT', 'OG', 'C', 'OL', 'G', 'LS']
        
        # Apply year filter if the column exists
        if year_col:
            print(f"Filtering for 2025 using column: {year_col}")
            df_filtered = df[df[year_col] == 2025].copy()
        else:
            df_filtered = df.copy()

        print(f"Removing OL positions using column: {pos_col}")
        df_filtered = df_filtered[~df_filtered[pos_col].isin(ol_positions)].copy()
        
        # 3. FANTASY RANK CALCULATION
        # Multipliers: QB (1.0), RB (1.5), WR (1.4), TE (1.2)
        multipliers = {'QB': 1.0, 'RB': 1.5, 'WR': 1.4, 'TE': 1.2}
        
        if rank_col:
            df_filtered['fantasy_rank'] = df_filtered.apply(
                lambda r: round(r[rank_col] / multipliers.get(r[pos_col], 1.0), 2) 
                if pd.notnull(r[rank_col]) else 999, axis=1
            )
        else:
            df_filtered['fantasy_rank'] = 999

        # 4. SAVE THE DATA
        os.makedirs('data', exist_ok=True)
        output_path = 'data/prospects_test_2025.csv'
        df_filtered.to_csv(output_path, index=False)
        
        print(f"✅ Success! Created {output_path} with {len(df_filtered)} players.")

    except Exception as e:
        print(f"❌ Error during processing: {e}")
        sys.exit(1) # This tells the GitHub Action to STOP and show a Red X if it fails

if __name__ == "__main__":
    run_draft_pipeline()

