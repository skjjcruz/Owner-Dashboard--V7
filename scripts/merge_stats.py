import pandas as pd
import os
import sys

def run_draft_pipeline():
    # NEW 2026 DATA SOURCE
    url = "https://raw.githubusercontent.com/danmorse314/nfl-draft/main/data/2026/consensus_board.csv"
    
    try:
        print("Connecting to 2026 Consensus Data...")
        df = pd.read_csv(url, low_memory=False)

        # 1. SMART COLUMN LOCATOR
        pos_col = next((c for c in ['pos', 'position', 'Pos', 'Position'] if c in df.columns), None)
        rank_col = next((c for c in ['consensus_rank', 'rank', 'Rank'] if c in df.columns), None)
        
        if not pos_col:
            print(f"Current columns: {df.columns.tolist()}")
            raise KeyError("Could not find a 'Position' column.")

        # 2. FILTERING (Remove OL, Keep 2026 Prospects)
        ol_positions = ['OT', 'OG', 'C', 'OL', 'G', 'LS']
        print(f"Screening Offensive Linemen using column: {pos_col}")
        df_filtered = df[~df[pos_col].isin(ol_positions)].copy()
        
        # 3. FANTASY MULTIPLIERS (Weighted Rankings)
        multipliers = {'QB': 1.0, 'RB': 1.5, 'WR': 1.4, 'TE': 1.2}
        if rank_col:
            df_filtered['fantasy_rank'] = df_filtered.apply(
                lambda r: round(r[rank_col] / multipliers.get(r[pos_col], 1.0), 2) 
                if pd.notnull(r[rank_col]) else 999, axis=1
            )
        else:
            df_filtered['fantasy_rank'] = 999

        # 4. SAVE DATA (Match your YAML path)
        os.makedirs('data', exist_ok=True)
        output_path = 'data/prospects_test_2025.csv' # Keeping name same so website doesn't break
        df_filtered.to_csv(output_path, index=False)
        
        print(f"✅ Success! Created {output_path} with {len(df_filtered)} 2026 players.")

    except Exception as e:
        print(f"❌ Error during 2026 sync: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_draft_pipeline()
