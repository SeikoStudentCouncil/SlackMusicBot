function doPost(e) {
    if (e.parameters.token != VERIFICATION_TOKEN) {
      logReturn("Err: invaild token");
    }

    if (!e.parameters.channel_name.includes("音楽")) {
      logReturn("Err: invaild channel");
    }

    const commandParams = e.parameters.text;
  }
  
  function logReturn(log) {
    const response = { text: log };
    return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
  }