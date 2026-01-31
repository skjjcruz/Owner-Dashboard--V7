import pandas as pd
import requests
from bs4 import BeautifulSoup
import os
import sys

def run_draft_pipeline():
    url = "https://www.nflmockdraftdatabase.com/big-boards/2026/consensus-big-board-2026"
    headers = {'User-Agent': 'Mozilla/5.0'} # Pretend to be a browser to avoid getting blocked
    
    try:
        print("Scraping 2026 NFL Mock Draft Database...")
        response = requests.get(url, headers=headers)
        soup = BeautifulSoup(response.content, 'html.parser')

        players = []
        # NFLMDDB stores players in 'prospect-list-item' classes
        items = soup.find_all('div', class_='prospect-list-item')

        for item in items:
            try:
                # Extracting Data from their specific layout
                name = item.find('div', class_='player-name').text.strip()
                pos = item.find('div', class_='position-label').text.strip()
                rank = item.find('div', class_='rank-number').text.strip()
                
                players.append({
                    'player': name,
                    'pos': pos,
                    'rank': rank
                })
            except AttributeError:
                continue # Skip items that don't have full info

        df = pd.DataFrame(players)

        if df.empty:
            raise ValueError("Scraper found 0 players. The website layout might have changed.")

        # 1. CLEANING
        df['rank'] = pd.to_numeric(df['rank'], errors='coerce').fillna(999)
        
        # 2. FILTERING (Screen out OL)
        ol_positions = ['OT', 'OG', 'C', 'OL', 'G', 'LS', 'IOL']
        df_filtered = df[~df['pos'].str.upper().isin(ol_positions)].copy()

        # 3. FANTASY MULTIPLIERS
        multipliers = {'QB': 1.0, 'RB': 1.5, 'WR': 1.4, 'TE': 1.2}
        df_filtered['fantasy_rank'] = df_filtered.apply(
            lambda r: round(r['rank'] / multipliers.get(r['pos'].upper(), 1.0), 2), axis=1
        )

        # 4. SAVE
        os.makedirs('data', exist_ok=True)
        output_path = 'data/prospects_test_2025.csv'
        df_filtered.to_csv(output_path, index=False)
        
        print(f"✅ Success! Captured {len(df_filtered)} players for 2026.")

    except Exception as e:
        print(f"❌ Scraper failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_draft_pipeline()
