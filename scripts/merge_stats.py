import pandas as pd
import os
import sys

def run_draft_pipeline():
    """Process the NFL Mock Draft Database CSV and apply fantasy rankings."""

    input_file = 'data/mock_draft_db.csv'
    output_file = 'data/prospects_test_2025.csv'  # Keep this name so the app doesn't break

    try:
        print("Processing NFL Mock Draft Database...")

        # Check if input file exists
        if not os.path.exists(input_file):
            print(f"❌ Input file not found: {input_file}")
            print("Please upload mock_draft_db.csv to the data/ folder")
            sys.exit(1)

        df = pd.read_csv(input_file)
        print(f"Loaded {len(df)} players from {input_file}")

        # STEP 1: NORMALIZE COLUMNS
        df.columns = df.columns.astype(str).str.strip().str.lower()

        # STEP 2: RENAME FOR DASHBOARD
        # Mock Draft DB columns: Rank, Player Name, Position, College
        column_mapping = {
            'player name': 'player',
            'position': 'pos',
            'rank': 'rank',
            'college': 'school'
        }
        df = df.rename(columns=column_mapping)

        # STEP 3: CLEAN POSITION DATA
        df['pos'] = df['pos'].astype(str).str.strip().str.upper()

        # STEP 4: FILTERING (Screen out Offensive Linemen)
        ol_positions = ['OT', 'OG', 'C', 'OL', 'G', 'LS', 'IOL', 'OC']
        df_filtered = df[~df['pos'].isin(ol_positions)].copy()
        print(f"After filtering OL: {len(df_filtered)} players remain")

        # STEP 5: FANTASY MULTIPLIERS
        # Higher multiplier = more valuable for fantasy
        multipliers = {'QB': 1.0, 'RB': 1.5, 'WR': 1.4, 'TE': 1.2}
        df_filtered['rank'] = pd.to_numeric(df_filtered['rank'], errors='coerce').fillna(999)

        df_filtered['fantasy_rank'] = df_filtered.apply(
            lambda r: round(r['rank'] / multipliers.get(r['pos'], 1.0), 2), axis=1
        )

        # STEP 6: SAVE
        os.makedirs('data', exist_ok=True)
        df_filtered.to_csv(output_file, index=False)
        print(f"✅ Success! Saved {len(df_filtered)} players to {output_file}")

    except Exception as e:
        print(f"❌ Processing failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_draft_pipeline()
