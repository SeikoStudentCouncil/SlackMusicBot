const SPOTIFY_API_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_SEARCH_URL = 'https://api.spotify.com/v1/search';
const APPLEMUSIC_API_SEARCH_URL = 'https://api.music.apple.com/v1/catalog/jp/search';
const SLACK_API_POST_URL = 'https://slack.com/api/chat.postMessage';

const PROPERTIES = PropertiesService.getScriptProperties();
const SPOTIFY_BASIC_AUTHORIZATION = PROPERTIES.getProperty('SPOTIFY_BASIC_AUTHORIZATION');
const APPLEMUSIC_TOKEN = PROPERTIES.getProperty('APPLEMUSIC_TOKEN');
const SLACK_BOT_TOKEN =  PROPERTIES.getProperty('SLACK_BOT_TOKEN');

var spotifyAccessToken;

function doPost(e) {
  /*
  if (e.parameters.token != VERIFICATION_TOKEN) {
    return logReturn('Err 40x: Invaild Token');
  }*/

  if (!e.parameter.channel_name.includes('音楽')) {
    return logReturn('Err 30c: Invaild Channel');
  }

  let params = e.parameter.text;
  const spotifyInfo = searchInSpotify(params);
  const appleMusicInfo = searchInAppleMusic(params);

  if (spotifyInfo.error) {
    return logReturn(spotifyInfo.error);
  }
  const description = {
    track:  `/ ${spotifyInfo.artists} - ${spotifyInfo.album_name || ''}`,
    album:  `/ ${spotifyInfo.artists} (${spotifyInfo.album_type})`,
    artist: `(${spotifyInfo.genres})`
  };
  const info = `
  from: <@${e.parameter.user_id}>
  ${spotifyInfo.name} ${description[spotifyInfo.type]}
  :spotify: Spotify: ${spotifyInfo.link} 
  :applemusic: Apple Music: ${appleMusicInfo.link}
  `.replace(/^\n|\s+$|^ {2}/gm, '').trim();  // 2: indent spaces of formated code
  postMessageToSlack(e.parameter.channel_id, info);
  return ContentService.createTextOutput('');
}

function postMessageToSlack(channelId, message) {
  const payload = {
    token : SLACK_BOT_TOKEN,
    channel : channelId,
    text : message
  };
  
  const params = {
    method : "POST",
    payload : payload
  };
  
  UrlFetchApp.fetch(SLACK_API_POST_URL, params);
}

function searchInSpotify(queryTextsCand) {
  let [typeCand, queryTextsCandShort] = queryTextsCand.split(' ', 2);
  let type, queryTexts;
  if (['song', 'album', 'artist'].includes(typeCand)) {
    type = typeCand.replace('song', 'track');
    queryTexts = queryTextsCandShort;
  } else {
    type = 'track';  // [type] default: track
    queryTexts = queryTextsCand;
  }
  const params = { 'q': queryTexts, 'type': type };
  res = requestToSpotifyAPI(SPOTIFY_API_SEARCH_URL, params);

  if (res.error) {
    e = res.error;
    return { error: `Err ${e.status}: Spotify API did not return any values (${e.message})` };
  }
  
  const items = res[`${type}s`].items;
  if (items.length == 0) {
    return { error: `Err 000: Spotify API returned no items` };
  }
  const item = items[0];

  let info = {
    name: item.name,
    link: item.external_urls.spotify,
    type: type
  };
  switch (type) {
    case 'track':
      info.artists = item.artists.map(artist => artist.name).join(', ');
      if (item.album.album_type != "single") {
        info.album_name = item.album.name;
      }
    case 'album':
      info.artists = item.artists.map(artist => artist.name).join(', ');
      info.album_type = item.album_type;
    case 'artist':
      info.genres = item.genres;
  }
  return info;
}

function searchInAppleMusic(queryTextsCand) {
  let [typeCand, queryTextsCandShort] = queryTextsCand.split(' ', 2);
  let type, queryTexts;
  if (['song', 'album', 'artist'].includes(typeCand)) {
    type = typeCand;
    queryTexts = queryTextsCandShort;
  } else {
    type = 'song';  // [type] default: song
    queryTexts = queryTextsCand;
  }
  const params = {
    term: queryTexts.replace(' ', '+'),
    limit: '1',
    types: `${type}s`
  };
  res = requestToAppleMusicAPI(APPLEMUSIC_API_SEARCH_URL, params);

  const AppleMusicOpenLink = res.results[`${type}s`].data[0].attributes.url;
  return { link: AppleMusicOpenLink }; // info
}
  
function logReturn(log) {
  const response = { text: log };
  return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
}

function requestToSpotifyAPI(url, parameters) {
  spotifyAccessToken = PropertiesService.getScriptProperties().getProperty('spotify_access_token');
  while (true) {
    const headers = {
      'Authorization': 'Bearer ' + spotifyAccessToken, 
      'Accept': 'application/json',
      'Accept-Language': 'ja;q=1',
      'Content-Type': 'application/json' 
    };
  
    const options = {
      method: 'GET',
      headers: headers,
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(`${url}?${hashToQuery(parameters)}`, options);
    const response_code = response.getResponseCode();
    switch (response_code) {
      case 200:
        return JSON.parse(response.getContentText());
      case 401:
        spotifyAccessToken = refreshAccessTokenToSpotify();
      case 429:
        Utilities.sleep(10000);
      default:
        return response_code;
    }
  }
}

function requestToAppleMusicAPI(url, parameters) {
  const headers = {
    'Authorization': 'Bearer ' + APPLEMUSIC_TOKEN, 
    'Accept': 'application/json', 
    'Content-Type': 'application/json' 
  };

  const options = {
    method: 'GET',
    headers: headers,
    muteHttpExceptions: true
  };

  while (true) {
    const response = UrlFetchApp.fetch(`${url}?${hashToQuery(parameters)}`, options);
    const response_code = response.getResponseCode();
    switch (response_code) {
      case 200:
        return JSON.parse(response.getContentText());
      case 429:
        Utilities.sleep(10000);
      default:
        return response_code;
    }
  }
}

function hashToQuery(hashList) {
  const result = [];
  for (let key in hashList) {
    result.push(`${key}=${hashList[key]}`);
  }
  return result.join('&');
}

function firstTime() {
  const properties = PropertiesService.getScriptProperties();
  const spotifyClientId = properties.getProperty('SPOTIFY_CLIENT_ID');
  const spotifyClientSecret = properties.getProperty('SPOTIFY_CLIENT_SECRET');
  const spotifyBasicAuthorization = Utilities.base64Encode(`${spotifyClientId}:${spotifyClientSecret}`);
  const spotifyAuthorizationCode = properties.getProperty('SPOTIFY_AUTHORIZATION_CODE');
  setFirstAccessTokenToSpotify(spotifyAuthorizationCode, spotifyBasicAuthorization);
}

function setFirstAccessTokenToSpotify(authorizationCode, basicAuthorization) {
  const scriptProperties = PropertiesService.getScriptProperties();

  const headers = { 'Authorization': 'Basic ' + basicAuthorization };
  const payload = {
    'grant_type': 'authorization_code',
    'code': authorizationCode,
    'redirect_uri': 'https://example.com/callback'
  };
  const options = {
    payload: payload,
    headers: headers
  };
  const response = JSON.parse(UrlFetchApp.fetch(SPOTIFY_API_TOKEN_URL, options));

  scriptProperties.setProperties({
    'SPOTIFY_BASIC_AUTHORIZATION': basicAuthorization,
    'spotify_access_token': response.access_token,
    'spotify_refresh_token': response.refresh_token
  });
  return;
}

function refreshAccessTokenToSpotify() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const refreshToken = scriptProperties.getProperty('spotify_refresh_token');

  const headers = {
    'Authorization': 'Basic ' + SPOTIFY_BASIC_AUTHORIZATION,
    'Content-Type': 'application/x-www-form-urlencoded'
  };
  const payload = {
    'grant_type': 'refresh_token',
    'refresh_token': refreshToken
  };
  const options = {
    payload: payload,
    headers: headers
  };
  const response = JSON.parse(UrlFetchApp.fetch(SPOTIFY_API_TOKEN_URL, options));

  scriptProperties.setProperty('spotify_access_token', response.access_token);

  if (response.refresh_token) {
    scriptProperties.setProperty('spotify_refresh_token', response.refresh_token);
  }
  return response.access_token;
}
