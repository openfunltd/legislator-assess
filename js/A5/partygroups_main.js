$(document).ready(main());

async function main() {
  const GET_term = document.location.search.match(/term=([0-9]*)/);
  const GET_sessionPeriod = document.location.search.match(/sessionPeriod=([0-9]*)/);
  let term = (GET_term) ? GET_term[1] : 10;
  let sessionPeriod = (GET_sessionPeriod) ? GET_sessionPeriod[1] : 6;
  term = encodeURIComponent(term);
  sessionPeriod = encodeURIComponent(sessionPeriod);

  $(".term-session").text(`${term}-${sessionPeriod}`);
  $(document).prop('title', $("#title").text());

  const legislators = await getLegislators(term);
  let partyGroups = legislators.reduce(function (acc, curr) {
    const partyGroup = curr.partyGroup;
    if (partyGroup != "0無" && !acc.includes(partyGroup)) { acc.push(partyGroup) };
    return acc;
  }, []);
  partyGroups = partyGroups.map((partyGroup) => `${partyGroup}立法院黨團`);
  partyGroups = partyGroups.reverse();
  htmlBody = $("#body");
  columns = ["日期", "法案名稱", "提案編號", "主提案第一人", "主提案非第一人", "是否併案"];

  for (const [idx, partyGroup] of partyGroups.entries()) {
    htmlBody.append(`<div class="text-center"><h4>${partyGroup}</h4></div>`);
    const containerDiv = $('<div>').attr({
      'class': 'container table-responsive',
      'style': 'overflow-x: auto;'
    });
    const table = $('<table>').attr({
      'id': `A5-${idx}`,
      'class': 'table table-bordered table-hover table-sm nowrap',
      'align': 'center',
      'width': '100%'
    });
    const thead = $('<thead>');
    const tbody = $('<tbody>');
    const headerRow = $('<tr>');
    for (column of columns) {
      headerRow.append(`<td class="dt-head-center">${column}</td>`);
    }
    thead.append(headerRow);
    table.append(thead);
    table.append(tbody);
    containerDiv.append(table);
    htmlBody.append(containerDiv);
    htmlBody.append("<hr>");
  }
  htmlBody.append("<br><br><br>")

  let currentSessionBills = await getLegislatorLawBills(term, sessionPeriod);
  currentSessionBills = currentSessionBills.filter((bill) => bill.meet_id.split("-")[2] === sessionPeriod);
  let nextSessionBills = await getLegislatorLawBills(term, parseInt(sessionPeriod) + 1);
  nextSessionBills = nextSessionBills.filter((bill) => bill.meet_id.split("-")[2] === sessionPeriod);
  const bills = currentSessionBills.concat(nextSessionBills);
  let partyGroupsBills = Array.from({ length: partyGroups.length }, () => []);
  for (const bill of bills) {
    if (bill.議案名稱.includes("擬撤回前提之")) { continue };
    if (bill.提案人 === undefined) { continue };
    const idx = partyGroups.indexOf(bill.提案人[0])
    if (idx === -1) { continue };
    let rowData = [];
    let billName = bill.議案名稱;
    if (billName.substring(0, 2) === "廢止") {
      billName = billName.split("，")[0];
      billName = billName.replace(/[「」]/g, '');
    } else {
      const startIdx = billName.indexOf("「");
      const endIdx = billName.indexOf("」");
      billName = billName.substring(startIdx + 1, endIdx);
    }
    const theFirst = (bill.提案人.length >= 2) ? bill.提案人[1] : "No Data";
    const nonFirst = (bill.提案人.length >= 3) ? bill.提案人.slice(2).join("、") : "No Data";
    rowData.push(bill.first_time, billName, bill.提案編號, theFirst, nonFirst, "WIP");
    partyGroupsBills[idx].push(rowData);
  }

  for (const [idx, partyGroup] of partyGroups.entries()) {
    const table = $(`#A5-${idx}`).DataTable({
      keys: true,
      scrollX: true,
      fixedHeader: true,
      dom: '<<"row"<"col"B><"col filter_adjust"f>>>rtip',
      buttons: [
          'pageLength', 'copy', 'excel'
      ],
      order: [0, 'asc'],
    });
    table.rows.add(partyGroupsBills[idx]).draw(false);
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

function getLegislatorLawBills(term, sessionPeriod) {
  return new Promise((resolve, reject) => {
    const url = `https://v1.ly.govapi.tw/bill/?term=${term}&sessionPeriod=${sessionPeriod}` +
      "&bill_type=法律案&bill_type=修憲案&proposal_type=委員提案&limit=2000&field=提案人";
    $.getJSON(url, function(data) {
      resolve(data.bills);
    });
  });
}
