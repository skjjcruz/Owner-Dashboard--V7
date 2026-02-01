import pandas as pd
import requests
import time
import json
import re
import os
from urllib.parse import quote

def search_espn_player(player_name, school, position):
    """Search ESPN for a college football player and return their ID."""

    # Clean up school name for search
    school_clean = school.replace("(FL)", "").replace("(OH)", "").strip()

    # ESPN search API
    search_url = f"https://site.web.api.espn.com/apis/common/v3/search?query={quote(player_name)}&limit=10&type=player"

    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }

    try:
        response = requests.get(search_url, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()

            # Look through results for college football players
            if 'results' in data:
                for result in data.get('results', []):
                    if result.get('type') == 'player':
                        for item in result.get('contents', []):
                            # Check if it's a college football player
                            league = item.get('league', {}).get('abbreviation', '')
                            if league == 'NCAAF' or 'college' in item.get('description', '').lower():
                                # Try to match school
                                description = item.get('description', '').lower()
                                if school_clean.lower() in description or school.lower() in description:
                                    player_id = item.get('id')
                                    if player_id:
                                        return str(player_id)

            # Fallback: try site search
            return search_espn_site(player_name, school_clean)

    except Exception as e:
        print(f"  Search error for {player_name}: {e}")

    return None

def search_espn_site(player_name, school):
    """Fallback: search ESPN college football athletes directly."""

    # Try the college football athlete search endpoint
    search_query = quote(f"{player_name} {school}")
    url = f"https://site.api.espn.com/apis/site/v2/sports/football/college-football/athletes?search={search_query}"

    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }

    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            athletes = data.get('athletes', [])

            for athlete in athletes:
                athlete_name = athlete.get('fullName', '').lower()
                athlete_school = athlete.get('team', {}).get('displayName', '').lower()

                # Check for name match
                if player_name.lower() in athlete_name or athlete_name in player_name.lower():
                    return str(athlete.get('id'))

    except Exception as e:
        pass

    return None

def get_espn_player_details(espn_id, player_name=None, school=None):
    """Get detailed player info from ESPN."""

    url = f"https://site.api.espn.com/apis/site/v2/sports/football/college-football/athletes/{espn_id}"

    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }

    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            athlete = data.get('athlete', data)

            details = {
                'espn_id': espn_id,
                'photo_url': None,
                'height': None,
                'weight': None,
                'hometown': None,
                'experience': None,
                'highlight_url': None,
                'espn_profile_url': None
            }

            # Get headshot
            headshot = athlete.get('headshot', {})
            if headshot:
                details['photo_url'] = headshot.get('href')
            else:
                # Construct default ESPN headshot URL
                details['photo_url'] = f"https://a.espncdn.com/combiner/i?img=/i/headshots/college-football/players/full/{espn_id}.png&w=350&h=254"

            # Get physical attributes
            details['height'] = athlete.get('displayHeight')
            details['weight'] = athlete.get('displayWeight')

            # Get hometown
            birth_place = athlete.get('birthPlace', {})
            if birth_place:
                city = birth_place.get('city', '')
                state = birth_place.get('state', '')
                details['hometown'] = f"{city}, {state}".strip(', ')

            # Get experience/class
            details['experience'] = athlete.get('experience', {}).get('displayValue')

            # ESPN profile URL
            details['espn_profile_url'] = f"https://www.espn.com/college-football/player/_/id/{espn_id}"

            # Try to get highlight video from ESPN
            highlight_url = get_espn_highlights(espn_id)
            if highlight_url:
                details['highlight_url'] = highlight_url
            elif player_name and school:
                # Fallback: YouTube search URL
                details['highlight_url'] = build_youtube_search_url(player_name, school)

            return details

    except Exception as e:
        print(f"  Error getting details for ESPN ID {espn_id}: {e}")

    return None

def get_espn_highlights(espn_id):
    """Try to get highlight video URL from ESPN."""

    url = f"https://site.api.espn.com/apis/site/v2/sports/football/college-football/athletes/{espn_id}/videos"

    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }

    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            videos = data.get('videos', [])

            # Look for highlight videos
            for video in videos:
                title = video.get('title', '').lower()
                if 'highlight' in title or 'draft' in title:
                    links = video.get('links', {})
                    web_link = links.get('web', {}).get('href')
                    if web_link:
                        return web_link

            # Return first video if no highlight found
            if videos:
                links = videos[0].get('links', {})
                return links.get('web', {}).get('href')

    except Exception:
        pass

    return None

def build_youtube_search_url(player_name, school):
    """Build a YouTube search URL for player highlights."""
    search_query = quote(f"{player_name} {school} football highlights 2025")
    return f"https://www.youtube.com/results?search_query={search_query}"

def enrich_players(input_csv, output_csv):
    """Main function to enrich player data with ESPN info."""

    print(f"Loading players from {input_csv}...")
    df = pd.read_csv(input_csv)

    # Determine column names (handle different CSV formats)
    name_col = next((c for c in ['name', 'Player Name', 'player_name', 'Name'] if c in df.columns), None)
    school_col = next((c for c in ['school', 'College', 'college', 'School'] if c in df.columns), None)
    pos_col = next((c for c in ['pos', 'Position', 'position', 'Pos'] if c in df.columns), None)

    if not name_col or not school_col:
        print(f"Error: Could not find name/school columns. Available: {df.columns.tolist()}")
        return

    print(f"Found columns - Name: {name_col}, School: {school_col}, Position: {pos_col}")
    print(f"Processing {len(df)} players...\n")

    # Add new columns
    df['espn_id'] = None
    df['photo_url'] = None
    df['espn_height'] = None
    df['espn_weight'] = None
    df['hometown'] = None
    df['highlight_url'] = None
    df['espn_profile_url'] = None

    found_count = 0

    for idx, row in df.iterrows():
        player_name = row[name_col]
        school = row[school_col]
        position = row[pos_col] if pos_col else ''

        print(f"[{idx+1}/{len(df)}] Searching: {player_name} ({school})...", end=" ")

        # Search for ESPN ID
        espn_id = search_espn_player(player_name, school, position)

        if espn_id:
            df.at[idx, 'espn_id'] = espn_id

            # Get detailed info (pass player name/school for YouTube fallback)
            details = get_espn_player_details(espn_id, player_name, school)
            if details:
                df.at[idx, 'photo_url'] = details.get('photo_url')
                df.at[idx, 'espn_height'] = details.get('height')
                df.at[idx, 'espn_weight'] = details.get('weight')
                df.at[idx, 'hometown'] = details.get('hometown')
                df.at[idx, 'highlight_url'] = details.get('highlight_url')
                df.at[idx, 'espn_profile_url'] = details.get('espn_profile_url')
                found_count += 1
                print(f"Found! ID: {espn_id}")
            else:
                print(f"ID found ({espn_id}) but no details")
        else:
            # Still provide YouTube search URL even if ESPN not found
            df.at[idx, 'highlight_url'] = build_youtube_search_url(player_name, school)
            print("Not found (YouTube fallback added)")

        # Rate limiting - be respectful
        time.sleep(0.3)

    # Save enriched data
    df.to_csv(output_csv, index=False)
    print(f"\n{'='*50}")
    print(f"Done! Found ESPN data for {found_count}/{len(df)} players ({100*found_count/len(df):.1f}%)")
    print(f"Saved to: {output_csv}")

    return df

def enrich_from_mock_draft_db(mock_draft_csv, output_csv):
    """Enrich Mock Draft Database CSV specifically."""

    print("="*50)
    print("NFL Mock Draft Database Enrichment Script")
    print("="*50 + "\n")

    return enrich_players(mock_draft_csv, output_csv)

if __name__ == "__main__":
    import sys

    # Default paths
    input_file = "data/mock_draft_db.csv"
    output_file = "data/mock_draft_db_enriched.csv"

    # Allow command line arguments
    if len(sys.argv) >= 2:
        input_file = sys.argv[1]
    if len(sys.argv) >= 3:
        output_file = sys.argv[2]

    # Check if input exists
    if not os.path.exists(input_file):
        # Try players.csv as fallback
        if os.path.exists("players.csv"):
            input_file = "players.csv"
            output_file = "players_enriched.csv"
        else:
            print(f"Error: Input file not found: {input_file}")
            print("Usage: python enrich_players.py <input_csv> [output_csv]")
            sys.exit(1)

    enrich_from_mock_draft_db(input_file, output_file)
