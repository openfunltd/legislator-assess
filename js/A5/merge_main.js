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

  const standingComtsCode = [15, 35, 19, 20, 22, 23, 36, 26];
  let committeesLegislators = Array.from({ length: 8 }, () => []);
  const type1Committees = await getType1Committees();
  const legislators = await getLegislators(term);

  for (const legislator of legislators) {
    for (const [i, comtCd] of standingComtsCode.entries()) {
      const comtName = type1Committees[comtCd];
      const isComt = legislator.committee.includes(`第${term}屆第${sessionPeriod}會期：${comtName}`);
      if (isComt) { committeesLegislators[i].push(legislator); }
    }
  }

  let partyGroups = legislators.reduce(function (acc, curr) {
    const partyGroup = curr.partyGroup;
    if (partyGroup != "0無" && !acc.includes(partyGroup)) { acc.push(partyGroup) };
    return acc;
  }, []);
  partyGroups = partyGroups.map((partyGroup) => `${partyGroup}立法院黨團`);

  let rowsData = [];
  let orderedLegislators = committeesLegislators.reduce((acc, curr) => acc.concat(curr), []);
  orderedLegislators = orderedLegislators.map((legislator) => legislator.name);
  const orderedLegislatorsGroups = orderedLegislators.concat(partyGroups);
  let currentSessionBills = await getLegislatorLawBills(term, sessionPeriod);
  currentSessionBills = currentSessionBills.filter((bill) => bill.meet_id.split("-")[2] === sessionPeriod);
  let nextSessionBills = await getLegislatorLawBills(term, parseInt(sessionPeriod) + 1);
  nextSessionBills = nextSessionBills.filter((bill) => bill.meet_id.split("-")[2] === sessionPeriod);
  let bills = currentSessionBills.concat(nextSessionBills);

  bills = bills.filter((bill) => !bill.議案名稱.includes("擬撤回前提之"));
  biils = bills.map(function (bill) {
    let billName = bill.議案名稱;
    if (billName.substring(0, 2) === "廢止") {
      billName = billName.split("，")[0];
      billName = billName.replace(/[「」]/g, '');
    } else {
      const startIdx = billName.indexOf("「");
      const endIdx = billName.indexOf("」");
      billName = billName.substring(startIdx + 1, endIdx);
    }
    let theFirst = "No Data";
    let nonFirst = "No Data";
    let nonFirstArr = [];
    if (bill.提案人 != undefined) {
      theFirst = bill.提案人[0];
      nonFirstArr = bill.提案人.slice(1);
    };
    if (nonFirstArr.length > 0) { nonFirst = nonFirstArr.join("、") };
    bill.billName = billName;
    bill.theFirst = theFirst;
    bill.nonFirst = nonFirst;
    bill.nonFirstArr = nonFirstArr;
    return bill;
  });

  let mergedlikeBills = [];
  let mergeIdx = 0;
  for (const member of orderedLegislatorsGroups) {
    const memberBills = bills.filter((bill) => member === bill.theFirst );
    let mergedBillGroups = {};
    for (const bill of memberBills) {
      const billName = bill.billName;
      const organicLawEndIdx = billName.indexOf("組織法");
      let actName = "";
      let departNameEndIdx = -1;
      let actNameEndIdx = -1;
      if (organicLawEndIdx > -1) {
        const departNameEndIdx0 = billName.indexOf("部");
        const departNameEndIdx1 = billName.indexOf("委員會");
        const departNameEndIdx2 = billName.indexOf("局");
        let departNameEndIdxArr = [departNameEndIdx0, departNameEndIdx1, departNameEndIdx2];
        departNameEndIdxArr = departNameEndIdxArr.filter((idx) => idx > -1 && idx < organicLawEndIdx);
        departNameEndIdx = Math.min(...departNameEndIdxArr);
        if (departNameEndIdx === departNameEndIdx1){
          actName = billName.substring(0, departNameEndIdx + 4) + "組織法";
        } else {
          actName = billName.substring(0, departNameEndIdx + 1) + "組織法";
        }
      } else {
        const actNameEndIdx0 = billName.indexOf("法");
        const actNameEndIdx1 = billName.indexOf("條例");
        actNameEndIdx = (actNameEndIdx0 >= actNameEndIdx1) ? actNameEndIdx0 : actNameEndIdx1;
        if (actNameEndIdx === actNameEndIdx0){
          actName = billName.substring(0, actNameEndIdx + 1);
        } else {
          actName = billName.substring(0, actNameEndIdx + 2);
        }
      }
      if (Object.keys(mergedBillGroups).includes(actName)) {
        mergedBillGroups[actName].push(bill);
      } else {
        mergedBillGroups[actName] = [bill];
      }
    }
    const aloneBills = Object.values(mergedBillGroups)
      .filter(val => val.length === 1)
      .flatMap(val => val);
    mergedBillGroups = Object.fromEntries(
      Object.entries(mergedBillGroups).filter(([key, val]) => val.length !== 1)
    );
    for (const [actName, mergedBills] of Object.entries(mergedBillGroups)) {
      ++mergeIdx;
      const mergeNo = `${term}-${sessionPeriod}-${mergeIdx}`;
      const mergeNote = (actName.includes("組織法")) ? `可能為不同法同目的-${actName}修訂` : "可能為同法修正";
      mergedBillGroups[actName] = mergedBills.map(function (bill) {
        bill.mergeNo = mergeNo;
        bill.mergeNote = mergeNote;
        return bill;
      });
      mergedlikeBills = mergedlikeBills.concat(mergedBillGroups[actName]);
    }
    mergedlikeBills = mergedlikeBills.concat(aloneBills);
  }
  mergedlikeBills = mergedlikeBills.concat(bills.filter((bill) => bill.theFirst === "No Data"));

  for (const bill of mergedlikeBills) {
    let rowData = [];
    const mergeNo = (bill.mergeNo === undefined) ? "" : bill.mergeNo;
    const mergeNote = (bill.mergeNote === undefined) ? "" : bill.mergeNote;
    rowData.push(mergeNo, bill.first_time, bill.billName, bill.提案編號);
    rowData.push(bill.theFirst, bill.nonFirst, mergeNote);
    rowsData.push(rowData);
  }

  const table = $(`#${tableId}`).DataTable({
    keys: true,
    scrollX: true,
    order: [],
    columnDefs: [{targets: "nosort", orderable: false}],
    fixedHeader: true,
    dom: '<<"row"<"col"B><"col filter_adjust"f>>>rtip',
    buttons: [
        'pageLength', 'copy', 'excel'
    ],
  });

  table.rows.add(rowsData).draw(false);
}

function getLegislatorLawBills(term, sessionPeriod) {
  return new Promise((resolve, reject) => {
    const url = `https://ly.govapi.tw/v1/bill/?term=${term}&sessionPeriod=${sessionPeriod}` +
      "&bill_type=法律案&bill_type=修憲案&proposal_type=委員提案&limit=2000&field=提案人";
    $.getJSON(url, function(data) {
      resolve(data.bills);
    });
  });
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

