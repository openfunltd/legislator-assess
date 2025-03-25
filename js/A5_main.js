$(document).ready(main("A5"));

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

  let partyGroups = legislators.reduce(function (acc, curr) {
    const partyGroup = curr.partyGroup;
    if (partyGroup != "0無" && !acc.includes(partyGroup)) { acc.push(partyGroup) };
    return acc;
  }, []);
  partyGroups = partyGroups.map((partyGroup) => `${partyGroup}立法院黨團`);

  let comtsMembersTheFirstCnt = {};
  let comtsMembersNonFirstCnt = {};
  for (const [comtCd, members] of Object.entries(committeeMembers)) {
    comtsMembersTheFirstCnt[comtCd] = Array(members.length).fill(0);
    comtsMembersNonFirstCnt[comtCd] = Array(members.length).fill(0);
  }

  let currentSessionBills = await getLegislatorLawBills(term, sessionPeriod);
  currentSessionBills = currentSessionBills.filter((bill) => bill.meet_id.split("-")[2] === sessionPeriod);
  let nextSessionBills = await getLegislatorLawBills(term, parseInt(sessionPeriod) + 1);
  nextSessionBills = nextSessionBills.filter((bill) => bill.meet_id.split("-")[2] === sessionPeriod);
  const bills = currentSessionBills.concat(nextSessionBills);
  for (bill of bills) {
    if (bill.議案名稱.includes("撤回前提之")) { continue };
    if (bill.提案人 === undefined) { continue };
    let theFirst = bill.提案人[0];
    let nonFirstArr = bill.提案人.slice(1);
    for (const [comtCd, members] of Object.entries(committeeMembers)) {
      const theFirstIdx = members.indexOf(theFirst);
      if (theFirstIdx > -1) { comtsMembersTheFirstCnt[comtCd][theFirstIdx]++ };
      for (nonFirst of nonFirstArr) {
        const nonFirstIdx = members.indexOf(nonFirst);
        if (nonFirstIdx > -1) { comtsMembersNonFirstCnt[comtCd][nonFirstIdx]++ };
      }
    }
  }

  for (const [comtCd, members] of Object.entries(committeeMembers)) {
    let rowsData = [];
    rowsData.push(["主提案第一人"].concat(comtsMembersTheFirstCnt[comtCd]));
    rowsData.push(["共提調整"].concat(Array(members.length).fill("-")));
    rowsData.push(["併案調整"].concat(Array(members.length).fill("-")));
    rowsData.push(["申請法案採計"].concat(Array(members.length).fill("-")));
    rowsData.push(["Final"].concat(Array(members.length).fill("-")));
    rowsData.push(["得分"].concat(Array(members.length).fill("-")));
    rowsData.push(["主提案非第一人"].concat(comtsMembersNonFirstCnt[comtCd]));
    rowsData.push(["併案調整"].concat(Array(members.length).fill("-")));
    rowsData.push(["申請法案採計"].concat(Array(members.length).fill("-")));
    rowsData.push(["筆數流用"].concat(Array(members.length).fill("-")));
    rowsData.push(["Final"].concat(Array(members.length).fill("-")));
    rowsData.push(["得分"].concat(Array(members.length).fill("-")));
    rowsData.push(["法律提案得分"].concat(Array(members.length).fill("-")));
    rowsData.push(["法律提案得分 (15%)"].concat(Array(members.length).fill("-")));
    const table = $(`#${tableId}-${comtCd}`).DataTable({
      keys: true,
      scrollX: true,
      pageLength: 14,
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

function getLegislators(term) {
  return new Promise((resolve, reject) => {
    const url = `https://v1.ly.govapi.tw/legislator/${term}?limit=300`;
    $.getJSON(url, function(data) {
      resolve(data.legislators);
    });
  });
}

function getType1Committees() {
  return new Promise((resolve, reject) => {
    $.getJSON("https://v1.ly.govapi.tw/committee", function(data) {
      let type1Committees = data.committees.filter(comt => comt.comtType === 1);
      type1Committees = type1Committees.reduce((acc, comt) => {
        acc[comt.comtCd] = comt.comtName;
        return acc;
      }, {});
      resolve(type1Committees);
    });
  });
}

function getLegislatorLawBills(term, sessionPeriod) {
  return new Promise((resolve, reject) => {
    const url = `https://v1.ly.govapi.tw/bill/?term=${term}&sessionPeriod=${sessionPeriod}` +
      "&bill_type=法律案&bill_type=修憲案&proposal_type=委員提案&limit=2000&field=提案人";
    $.getJSON(url, function(data) {
      resolve(data.bills);
    });
  });
}
