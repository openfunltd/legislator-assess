$(document).ready(main());


async function main() {
  const [latestTerm, latestSessionPeriod] = getLatestTermSessionPeriod();
  termSelectTag = $("#term");
  for (let term = 8; term <= latestTerm; term++) {
    isLatest = (term === latestTerm) ? true : false;
    termSelectTag.append(new Option(term, term, false, isLatest));
  }
  termSelectTag.attr("onchange",
    `displaySessionPeriod(false, ${latestTerm}, ${latestSessionPeriod}, this.value);`)

  displaySessionPeriod(true, latestTerm, latestSessionPeriod, termSelectTag.val());
  updateLinks();

  const stat = await getStat();
}

function getStat() {
  return new Promise((resolve, reject) => {
    const url = "https://ly.govapi.tw/v1/stat";
    $.getJSON(url, function(data) { resolve(data) });
  });
}

function getLatestTermSessionPeriod() {
  const now = new Date();
  nowYear = now.getFullYear();
  const term = Math.floor((nowYear - 2012) / 4) + 8;
  checkDate = new Date(nowYear, 6, 1);
  let sessionPeriod = (nowYear % 4) * 2 + 1;
  if (checkDate < now) { sessionPeriod++ };
  return [term, sessionPeriod];
}

function displaySessionPeriod(isInitial, latestTerm, latestSessionPeriod, selectedTerm){
  selectedTerm = parseInt(selectedTerm);
  const sessionPeriodSelectTag = $('#sessionPeriod');
  let maxSessionPeriod = 8;
  sessionPeriodSelectTag.find('option').each(function(idx){
    const option = $(this);
    if (option.is(':hidden') && idx <= maxSessionPeriod) { option.show() };
    if (idx > maxSessionPeriod) { option.hide() };
  });
  if (isInitial === true) {
    sessionPeriodSelectTag.val(latestSessionPeriod);
  } else {
    sessionPeriodSelectTag.val("");
  }
}

function updateLinks(){
  const term = $('#term').val();
  const sessionPeriod = $('#sessionPeriod').val();
  $('a.sheet').each(function(){
    const aTag = $(this);
    const hrefBase = aTag.attr('href').split('?')[0];
    const newHref = hrefBase + `?term=${term}&sessionPeriod=${sessionPeriod}`;
    aTag.attr("href", newHref);
    aTag.find('span').text(`${term}-${sessionPeriod}`);
  });
}
