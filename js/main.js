$(document).ready(main("A1"));


async function main(tableId) {
  const GET_term = document.location.search.match(/term=([0-9]*)/);
  const GET_sessionPeriod = document.location.search.match(/sessionPeriod=([0-9]*)/);
  let term = (GET_term) ? GET_term[1] : 10;
  let sessionPeriod = (GET_sessionPeriod) ? GET_sessionPeriod[1] : 6;
  term = encodeURIComponent(term);
  sessionPeriod = encodeURIComponent(sessionPeriod);

  $(document).prop('title', `A1 ${term}-${sessionPeriod} 院會出席整理`);
  $("#title").text(`A1 ${term}-${sessionPeriod} 院會出席整理`);

  const attendance = await getAttendance(term, sessionPeriod);

  const trHead0 = $("tr.head-row-0");
  const trHead1 = $("tr.head-row-1");
  for (let i = 0; i < attendance.length; i++) {
    trHead0.append($(`<td class="dt-head-center" colspan="3">第 ${i+1} 次會議</td>`));
    trHead1.append($('<td class="nosort">出席</td>'));
    trHead1.append($('<td class="nosort">請假</td>'));
    trHead1.append($('<td class="nosort">缺席</td>'));
  }

  const table = $('#' + tableId).DataTable({
    keys: true,
    scrollX: true,
    fixedColumns: {left: 6},
    columnDefs: [
        { orderable: false, targets: 'nosort' }
    ],
    fixedHeader: true,
    dom: '<<"row"<"col"B><"col filter_adjust"f>>>rtip',
    buttons: [
        'pageLength', 'copy', 'excel'
    ]
  });

  const legislators = await getLegislators(term, sessionPeriod);
  const type1Committees = await getType1Committees();

  let rowsData = [];
  let committee, sessionTimes, attended, leave;
  const removedLegislaters = ["陳柏惟", "王鴻薇", "陳培瑜", "蔡培慧"];
  legislators.forEach(legislator => {
    let rowData = {};
    if (removedLegislaters.includes(legislator.name)) { return; }
    rowData.name = legislator.name;
    rowData.party = legislator.party;
    committee = legislator.committee.filter(comt => comt.includes(`第${term}屆第${sessionPeriod}會期`)); 
    committee = committee.map(comt => comt.split("：")[1]);
    committee = committee.filter(comt => type1Committees.includes(comt))[0];
    if (committee === undefined) { committee = ""; };
    rowData.committee = committee;
    let total_count = 0;
    let attended_count = 0;
    let ccw_score = 0;
    attendance.forEach(meet => {
      sessionTimes = meet.sessionTimes.toString();
      attended = meet.議事錄.出席委員;
      leave = meet.議事錄.請假委員;
      if (leave === undefined){ leave = []; };
      if (attended.includes(rowData.name)){
        rowData[sessionTimes] = "attended";
        total_count += 1;
        attended_count += 1;
      } else if (leave.includes(rowData.name)){
        rowData[sessionTimes] = "leave";
      } else {
        total_count += 1;
        rowData[sessionTimes] = "absent";
      }
    });
    ccw_score = (attended_count/total_count) * 3;
    if (ccw_score != 3) {
      ccw_score = ccw_score.toFixed(3);
    }
    rowData.total_count = total_count;
    rowData.attended_count = attended_count;
    rowData.ccw_score = ccw_score;
    rowsData.push(rowData);
  });
  rowsData = rowsData.map(function(rowData){
    let row = [rowData.committee, rowData.party, rowData.name];
    row = row.concat([rowData.total_count, rowData.attended_count, rowData.ccw_score]);
    let meet_count = Object.keys(rowData).length - row.length;
    for(var i = 1; i <= meet_count; i++) {
      if (rowData[i.toString()] === "attended"){
        row = row.concat([1,0,0]);
      } else if (rowData[i.toString()] === "leave"){
        row = row.concat([0,1,0]);
      } else {
        row = row.concat([0,0,1]);
      }
    }
    return row;
  });
  table.rows.add(rowsData).draw(false);
  table.columns.adjust().draw();
}

function getAttendance(term, sessionPeriod) {
  return new Promise((resolve, reject) => {
    const url = "https://ly.govapi.tw/meet/" +
        "?term=" + term +
        "&sessionPeriod=" + sessionPeriod +
        "&meet_type=院會";
    $.getJSON(url, function(data) {
      resolve(data.meets);
    });
  });
}

function getType1Committees() {
  return new Promise((resolve, reject) => {
    $.getJSON("https://ly.govapi.tw/committee", function(data) {
      let type1Committees = data.committees.filter(comt => comt.comtType === 1);
      type1Committees = type1Committees.map(comt => comt.comtName);
      resolve(type1Committees);
    });
  });
}

function getLegislators(term, sessionPeriod) {
  return new Promise((resolve, reject) => {
    const url = "https://ly.govapi.tw/legislator/" + term + "?limit=300";
    $.getJSON(url, function(data) {
      resolve(data.legislators);
    });
  });
}
