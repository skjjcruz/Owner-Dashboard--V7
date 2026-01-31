import pandas as pd
import requests
from bs4 import BeautifulSoup
import os
import sys
import time

def run_draft_pipeline():
    url = "https://www.profootballnetwork.com/nfl-draft-hq/custom-big-board/"
    
    # Advanced headers to bypass bot detection
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://www.google.com/'
    }

    try:
        print("Starting PFN Scrape session...")
        session = requests.Session() # Persists cookies to look like a real user
        response = session.get(url, headers=headers, timeout=15)
        
        if response.status_code != 200:
            raise ConnectionError(f"Site blocked access (Status {response.status_code}).")

        soup = BeautifulSoup(response.content, 'html.parser')
        
        # PFN's board is often dynamic; we search for the standard table rows
        players = []
        rows = soup.find_all('tr') 

        for row in rows:
            cols = row.find_all('td')
            if len(cols) >= 3:
                name = cols[0].text.strip()
                pos = cols[1].text.strip()
                rank = cols[2].text.strip()
                
                # Basic validation to ensure it's a player row
                if name and pos and any(char.isdigit() for char in rank):
                    players.append({'player': name, 'pos': pos, 'rank': rank})

        df = pd.DataFrame(players)

        if df.empty:
            raise ValueError("Scraper found 0 players. The board might be loading via JavaScript.")

        # 1. FILTERING (No OL, 2026 Class)
        ol_positions = ['OT', 'OG', 'C', 'OL', 'G', 'LS', 'IOL']
        df_filtered = df[~df['pos'].str.upper().isin(ol_positions)].copy()
        
        # 2. FANTASY MULTIPLIERS
        multipliers = {'QB': 1.0, 'RB': 1.5, 'WR': 1.4, 'TE': 1.2}
        df_filtered['rank_num'] = pd.to_numeric(df_filtered['rank'].str.extract('(\d+)', expand=False), errors='coerce').fillna(999)
        
        df_filtered['fantasy_rank'] = df_filtered.apply(
            lambda r: round(r['rank_num'] / multipliers.get(r['pos'].upper(), 1.0), 2), axis=1
        )

        # 3. SAVE DATA
        os.makedirs('data', exist_ok=True)
        output_path = 'data/prospects_test_2025.csv'
        df_filtered.to_csv(output_path, index=False)
        
        print(f"✅ Success! Found {len(df_filtered)} 2026 prospects.")

    except Exception as e:
        print(f"❌ Scraper failure: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_draft_pipeline()

