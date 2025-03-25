$(document).ready(main("A2_A3"));


async function main(tableId) {
  const GET_term = document.location.search.match(/term=([0-9]*)/);
  const GET_sessionPeriod = document.location.search.match(/sessionPeriod=([0-9]*)/);
  let term = (GET_term) ? GET_term[1] : 10;
  let sessionPeriod = (GET_sessionPeriod) ? GET_sessionPeriod[1] : 6;
  term = encodeURIComponent(term);
  sessionPeriod = encodeURIComponent(sessionPeriod);

  $(".term-session").text(`${term}-${sessionPeriod}`);
  $(document).prop('title', $("#title").text());

  const type1Committees = await getType1Committees();
  const legislators = await getLegislators(term);
  let committeeMembers = {};
  for (const comtCd in type1Committees) {
    committeeMembers[comtCd] = [];
  }

  for (const [comtCd, comtName] of Object.entries(type1Committees)) {
    $(`#title-${comtCd}`).text(comtName);
    $(`#head-row-0-${comtCd}`).append(`<td class="dt-head-center">${comtName}</td>`);
    $(`#head-row-1-${comtCd}`).append(`<td class="dt-head-center">黨籍</td>`);
    $(`#head-row-2-${comtCd}`).append(`<td class="dt-head-center nosort">委員姓名</td>`);
  }

  for (const legislator of legislators) {
    for (const [comtCd, comtName] of Object.entries(type1Committees)) {
      const isComt = legislator.committee.includes(`第${term}屆第${sessionPeriod}會期：${comtName}`);
      if (isComt) {
        committeeMembers[comtCd].push(legislator.name);
        $(`#head-row-0-${comtCd}`).append(`<td class="dt-head-center">${committeeMembers[comtCd].length}</td>`);
        $(`#head-row-1-${comtCd}`).append(`<td class="dt-head-center">${legislator.party}</td>`);
        $(`#head-row-2-${comtCd}`).append(`<td class="dt-head-center nosort">${legislator.name}</td>`);
        continue;
      }
    }
  }
  
  for (const [comtCd, members] of Object.entries(committeeMembers)) {
    const membersCnt = members.length;
    let rowsData = [];
    let shouldAttendCnt = 0;
    let canOralCnt = 0;
    let membersAttendanceCnt = Array(membersCnt).fill(0);
    let membersOralCnt = Array(membersCnt).fill(0);
    let membersWrittenCnt = Array(membersCnt).fill(0);
    let membersWrittenValidCnt = Array(membersCnt).fill(0);
    const meetings = await getMeetings(term, sessionPeriod, comtCd);
    for (const meeting of meetings) {
      if(meeting.meet_type === "聯席會議" && !meeting.id.startsWith(`${term}-${sessionPeriod}-${comtCd}`, 5)) {
        continue;
      }
      if (meeting.meet_id.includes("臨時會委員會")) { continue };
      if (meeting.議事錄 === undefined) { continue; }
      const dates = formatDates(meeting.議事錄.時間);
      const attendees = meeting.議事錄.出席委員;
      const interpellations = meeting.議事錄.質詢;
      const leaveList = meeting.議事錄.請假委員;
      for (const [i, date] of dates.entries()) {
        if (i===0) { 
          shouldAttendCnt = shouldAttendCnt + 1;
          for (const [memberIdx, member] of members.entries()) {
            if (attendees.includes(member)) { ++membersAttendanceCnt[memberIdx]; }
          }
        }
        let [oral, written] = [[], []];
        if (interpellations != undefined) {
          oral = interpellations.filter(item => item.日期 === date && item.種類 === "口頭質詢");
          if (oral.length > 0) {
            oral = oral[0].委員;
            canOralCnt = canOralCnt + 1;
            /*
            for (const [memberIdx, member] of members.entries()) {
              if (oral.includes(member)) { ++membersOralCnt[memberIdx]; }
            }
            */
          }
          written = interpellations.filter(item => item.日期 === date && item.種類 === "書面質詢");
          if (written.length > 0) { written = written[0].委員 }
        }
        let oralMax = (oral.length > 0) ? 1 : 0;
        for (const [memberIdx, member] of members.entries()) {
          if (oral.includes(member)) { ++membersOralCnt[memberIdx]; }
          const hasOral = (oral.includes(member)) ? 1 : 0;
          const hasWritten = (written.includes(member)) ? 1 : 0;
          membersWrittenCnt[memberIdx] = membersWrittenCnt[memberIdx] + hasWritten;
          let writtenValidCnt = 0;
          if (oralMax > hasOral) {
            writtenValidCnt = (hasOral + hasWritten > oralMax) ? oralMax - hasOral : hasWritten;
          }
          membersWrittenValidCnt[memberIdx] = membersWrittenValidCnt[memberIdx] + writtenValidCnt;
        }
      }
    }
    let membersAttendanceRate = Array(membersCnt);
    let membersAttendanceScore = Array(membersCnt);
    let membersInterpellationRate = Array(membersCnt);
    let membersInterpellationScore = Array(membersCnt);
    for (let i = 0; i < membersCnt; i++) {
      membersAttendanceRate[i] = membersAttendanceCnt[i] / shouldAttendCnt;
      membersAttendanceScore[i] = (membersAttendanceRate[i] * 7).toFixed(2);
      membersAttendanceRate[i] = membersAttendanceRate[i].toFixed(2) * 100 + "%";
      membersInterpellationRate[i] = membersOralCnt[i] / canOralCnt;
      const [x, y, z] = [membersOralCnt[i], membersWrittenValidCnt[i], canOralCnt];
      membersInterpellationScore[i] = ((x * 20 + y * 10) / z).toFixed(2);
      membersInterpellationRate[i] = membersInterpellationRate[i].toFixed(2) * 100 + "%";
    }
    rowsData.push(["實際出席次數"].concat(membersAttendanceCnt));
    rowsData.push(["應出席次數"].concat(Array(membersCnt).fill(shouldAttendCnt)));
    rowsData.push(["出席率"].concat(membersAttendanceRate));
    rowsData.push(["委員會出席分數（7%）"].concat(membersAttendanceScore));
    rowsData.push(["實際質詢次數"].concat(membersOralCnt));
    rowsData.push(["可質詢次數"].concat(Array(membersCnt).fill(canOralCnt)));
    rowsData.push(["書面質詢次數"].concat(membersWrittenCnt));
    rowsData.push(["書面質詢次數"].concat(membersWrittenValidCnt));
    rowsData.push(["質詢率"].concat(membersInterpellationRate));
    rowsData.push(["質詢分數（20%）"].concat(membersInterpellationScore));
    const table = $(`#${tableId}-${comtCd}`).DataTable({
      keys: true,
      scrollX: true,
      order: [],
      columnDefs: [{targets: "nosort", orderable: false}],
      fixedHeader: true,
      dom: '<<"row"<"col"B>>>rtip',
      buttons: [
        'pageLength', 'copy', 'excel'
      ],
    });
    table.rows.add(rowsData).draw(false);
  }
}

function getMeetings(term, sessionPeriod, comtCd) {
  return new Promise((resolve, reject) => {
    const url = "https://ly.govapi.tw/v1/meet/" +
        "?term=" + term +
        "&sessionPeriod=" + sessionPeriod +
        "&committee_id=" + comtCd;
    $.getJSON(url, function(data) {
      resolve(data.meets);
    });
  });
}

function formatDates(dates) {
  dates = dates.replace("曰", "日");
  const yearPattern = /(\d+年)/g;
  const datePattern = /(\d+月\d+日)/g;
  const year = parseInt(dates.match(yearPattern)[0].slice(0, -1))  + 1911;
  const dateMatches = dates.match(datePattern);
  dates = dateMatches.map((match) => {
    const [month, day] = match.match(/(\d+)/g);
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  });
  return dates;
}

function getLegislators(term) {
  return new Promise((resolve, reject) => {
    const url = `https://ly.govapi.tw/v1/legislator/${term}?limit=300`;
    $.getJSON(url, function(data) {
      resolve(data.legislators);
    });
  });
}

function getType1Committees() {
  return new Promise((resolve, reject) => {
    $.getJSON("https://ly.govapi.tw/v1/committee", function(data) {
      let type1Committees = data.committees.filter(comt => comt.comtType === 1);
      type1Committees = type1Committees.reduce((acc, comt) => {
        acc[comt.comtCd] = comt.comtName;
        return acc;
      }, {});
      resolve(type1Committees);
    });
  });
}
