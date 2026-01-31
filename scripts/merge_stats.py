import pandas as pd
import requests
from bs4 import BeautifulSoup
import os
import sys
import time

def run_draft_pipeline():
    url = "https://www.nflmockdraftdatabase.com/big-boards/2026/consensus-big-board-2026"
    
    # ADVANCED HEADERS: This makes the site think you are a real person on a Mac
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
    }
    
    try:
        print("Scraping 2026 Consensus Big Board...")
        response = requests.get(url, headers=headers, timeout=15)
        
        if response.status_code != 200:
            raise ConnectionError(f"Site blocked us with code: {response.status_code}")

        soup = BeautifulSoup(response.content, 'html.parser')
        players = []

        # UPDATED SELECTOR: NFLMDDB uses 'list-item' and specific data attributes
        # We are looking for the container that holds name, rank, and position
        items = soup.find_all('div', class_='list-item')

        for item in items:
            try:
                # Find Name
                name_tag = item.find('div', class_='player-name')
                # Find Position 
                pos_tag = item.find('div', class_='position-label')
                # Find Rank
                rank_tag = item.find('div', class_='rank-number')

                if name_tag and pos_tag:
                    players.append({
                        'player': name_tag.get_text(strip=True),
                        'pos': pos_tag.get_text(strip=True),
                        'rank': rank_tag.get_text(strip=True) if rank_tag else "999"
                    })
            except Exception:
                continue

        df = pd.DataFrame(players)

        if df.empty:
            # FALLBACK: If the div classes failed, print the body to help debug
            print("Debug: No players found in standard divs. Trying fallback tags...")
            raise ValueError("Scraper found 0 players. NFLMDDB may have updated their CSS names.")

        # 1. CLEANING & FILTERING
        df['rank'] = pd.to_numeric(df['rank'], errors='coerce').fillna(999)
        ol_positions = ['OT', 'OG', 'C', 'OL', 'G', 'LS', 'IOL']
        df_filtered = df[~df['pos'].str.upper().isin(ol_positions)].copy()

        # 2. FANTASY MULTIPLIERS
        multipliers = {'QB': 1.0, 'RB': 1.5, 'WR': 1.4, 'TE': 1.2}
        df_filtered['fantasy_rank'] = df_filtered.apply(
            lambda r: round(r['rank'] / multipliers.get(r['pos'].upper(), 1.0), 2), axis=1
        )

        # 3. SAVE TO REPO
        os.makedirs('data', exist_ok=True)
        output_path = 'data/prospects_test_2025.csv'
        df_filtered.to_csv(output_path, index=False)
        
        print(f"✅ Success! Captured {len(df_filtered)} players (2026 Class).")

    except Exception as e:
        print(f"❌ Scraper failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_draft_pipeline()
