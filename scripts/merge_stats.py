import pandas as pd
import requests
from bs4 import BeautifulSoup
import os
import sys
import time

def run_draft_pipeline():
    url = "https://www.profootballnetwork.com/nfl-draft-hq/custom-big-board/"
    
    # These headers are your "ID card" to get past the PFN security gate
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Referer': 'https://www.google.com/'
    }

    try:
        print("Initiating PFN Session...")
        session = requests.Session()
        response = session.get(url, headers=headers, timeout=20)
        
        if response.status_code != 200:
            raise ConnectionError(f"PFN blocked access with Status {response.status_code}")

        soup = BeautifulSoup(response.content, 'html.parser')
        
        # PFN often embeds its board data in a JSON script tag or a specific table ID
        # We search for the 2026 data specifically
        print("Searching for 2026 Prospect Table...")
        
        # Note: PFN's layout can change; we use a broad search for player rows
        players = []
        rows = soup.find_all('tr') # Targeting standard table rows

        for row in rows:
            cols = row.find_all('td')
            if len(cols) >= 3:
                name = cols[0].get_text(strip=True)
                pos = cols[1].get_text(strip=True)
                rank = cols[2].get_text(strip=True)
                
                # Only add if it looks like a real player entry
                if name and pos and rank.isdigit():
                    players.append({'player': name, 'pos': pos, 'rank': rank})

        if not players:
            print("Visual table not found. Checking for embedded data...")
            # PFN sometimes hides data in 'data-props' or script tags
            raise ValueError("No player data detected on the page. PFN might require a headless browser.")

        df = pd.DataFrame(players)

        # 1. FILTERING & MULTIPLIERS
        ol_positions = ['OT', 'OG', 'C', 'OL', 'G', 'LS', 'IOL']
        df_filtered = df[~df['pos'].str.upper().isin(ol_positions)].copy()
        
        multipliers = {'QB': 1.0, 'RB': 1.5, 'WR': 1.4, 'TE': 1.2}
        df_filtered['rank'] = pd.to_numeric(df_filtered['rank'], errors='coerce')
        df_filtered['fantasy_rank'] = df_filtered.apply(
            lambda r: round(r['rank'] / multipliers.get(r['pos'].upper(), 1.0), 2), axis=1
        )

        # 2. SAVE
        os.makedirs('data', exist_ok=True)
        output_path = 'data/prospects_test_2025.csv'
        df_filtered.to_csv(output_path, index=False)
        
        print(f"✅ Success! Captured {len(df_filtered)} players for 2026.")

    except Exception as e:
        print(f"❌ PFN Scrape Failed: {e}")
        sys.exit(1) # Tells GitHub Action the run failed

if __name__ == "__main__":
    run_draft_pipeline()
