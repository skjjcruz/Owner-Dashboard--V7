 import pandas as pd
import os

def run_draft_pipeline():
    # 1. Configuration
    # We are using 2025 as the test year per our plan
    target_year = 2025 
    
    # URL for Jack Lichtenstein's consolidated data
    url = "https://raw.githubusercontent.com/JackLich10/nfl-draft-data/main/nfl_draft_prospects.csv"
    
    # List of offensive line positions to remove (Screening)
    ol_positions = ['OT', 'OG', 'C', 'OL', 'G', 'LS']
    
    try:
        print(f"--- Starting Pipeline for {target_year} ---")
        
        # 2. Fetch Data
        # Using low_memory=False to handle the large historical dataset
        df = pd.read_csv(url, low_memory=False)
        
        # 3. Filter for Year and Screen Positions
        # We use 'year' as the column based on Jack's schema
        df_filtered = df[
            (df['year'] == target_year) & 
            (~df['pos'].isin(ol_positions))
        ].copy()
        
        # 4. Cleanup and Sort
        # We ensure players are sorted by their consensus rank (best players first)
        # Note: 'consensus_rank' is the standard column name in Jack's CSV
        df_filtered = df_filtered.sort_values(by='consensus_rank', ascending=True)
        
        # 5. Final Formatting for your App
        # We'll keep the columns most likely needed for your multiplier/dashboard
        columns_to_keep = [
            'player_name', 'pos', 'school', 'consensus_rank', 
            'standard_deviation', 'player_id'
        ]
        
        # Only keep columns that actually exist in the source
        existing_cols = [c for c in columns_to_keep if c in df_filtered.columns]
        final_board = df_filtered[existing_cols]
        
        # 6. Save the output
        os.makedirs('data', exist_ok=True)
        output_path = 'data/prospects_test_2025.csv'
        final_board.to_csv(output_path, index=False)
        
        print(f"--- Success! ---")
        print(f"Saved {len(final_board)} fantasy-relevant prospects to {output_path}")

    except Exception as e:
        print(f"!!! Error occurred: {e} !!!")

if __name__ == "__main__":
    run_draft_pipeline()
