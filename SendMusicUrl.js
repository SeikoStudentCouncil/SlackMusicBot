const SPOTIFY_API_SEARCH_URL = 'https://api.spotify.com/v1/search'

function doPost(e) {
  if (e.parameters.token != VERIFICATION_TOKEN) {
    return logReturn('Err 40x: Invaild Token');
  }

  if (!e.parameters.channel_name.includes('音楽')) {
    return logReturn('Err 30c: Invaild Channel');
  }

  let params = e.parameters.text;
  
  const SpotifyInfo = SearchInSpotify(params);
  const Info = SpotifyInfo; // Spotify Info + Apple Music Info
  return Info;
}

function SearchInSpotify(queryTextsCand) {
  let [tagCand, queryTextsCandShort] = queryTextsCand.split(" ", 2);
  let type, queryTexts;
  if (['track', 'album', 'artist', 'playlist'].includes(typeCand)) {
    type = tagCand;
    queryTexts = queryTextsCandShort;
  } else {
    type = 'track'; // [type] default: track
    queryTexts = queryTextsCand;
  }
  const params = { 'q': queryTexts, 'type': type };
  res = requestToSpotifyAPI(SPOTIFY_API_SEARCH_URL, params);

  if (res.error) {
    e = res.error;
    return `Err ${e.status}: Spotify API did not return any values (${e.message})`;
  }

  const SpotifyOpenLink = res[`${type}s`].items[0].externak_urls.spotify;
  return SpotifyOpenLink; //info
}
  
function logReturn(log) {
  const response = { text: log };
  return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
}

function requestToSpotifyAPI(url, parameters) {
  const headers = {
    'Authorization': 'Bearer ' + TOKEN, 
    'Accept': 'application/json', 
    'Content-Type': 'application/json' 
  };

  const qpls = {
    method: 'GET',
    headers: headers,
    muteHttpExceptions: true
  };

  while (true) {
    const response = UrlFetchApp.fetch(`${url}?${hashToQuery(parameters)}`, qpls);
    const response_code = response.getResponseCode();
    if (response_code === 200) {
      return JSON.parse(response.getContentText());
    } else if (response_code === 429) {
      Utilities.sleep(10000);
    }
  }
  
}

function hashToQuery(hashList) {
  const result = [];
  for (let key in hashList) {
    result.push(`${key}=${hashList[key]}`);
  }
  return result.join("&");
}