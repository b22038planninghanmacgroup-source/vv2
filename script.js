// ═══════════════════════════════════════════════
//  데이터
// ═══════════════════════════════════════════════
const companies = {
  baron: {
    name: '주식회사 바론컨설턴트',
    shortName: '(주)바론컨설턴트',
    regNo: '215-86-86507',
    corp: '주식회사 바론컨설턴트',
    ceo: '장 종 찬',
    address: '서울시 송파구 오금로 554(거여동)',
    bizType: '서비스업 / 측량업, 소프트웨어개발 외',
    tel: '02-2141-7434',
    fax: '02-2141-7342',
    contact: '기획실 홍길동연구원 02-2141-0000',
    bank: '국민은행  006037-04-003351  주식회사 바론컨설턴트',
    validity: '견적일로부터 15일',
    payCondition: '현금지급 조건',
    stamp: 'images/바론사용인감.png'
  },
  jh: {
    name: '주식회사 장헌',
    shortName: '(주)장헌',
    regNo: '666-81-03617',
    corp: '주식회사 장헌',
    ceo: '김 승 국',
    address: '충청남도 당진시 고대면 성산로 464',
    bizType: '제조업 / 콘크리트 제품 제조',
    tel: '02-0000-0000',
    fax: '02-0000-0001',
    contact: '',
    bank: '국민은행  000000-00-000000  장헌기술단',
    validity: '견적일로부터 15일',
    payCondition: '현금지급 조건',
    stamp: 'images/주장헌 사용인감(인재성장보관).png'
  }
};

let currentCompany = 'baron';
let currentLayout  = 'A'; // A | B
let rowCount = 6;

// 레이아웃별 독립된 데이터 저장소
let dataA = null;
let dataB = null;
let _showSWPage = false;

const defaultMemo = ``;

// ── 구글 스프레드시트 공유 견적번호 설정 ──
const GS_URL = "https://script.google.com/macros/s/AKfycbywK7uHSTeY9JrVfJCr3kLvAB-Jlt-ixM1I0Z6U3lqJEpPmpyGSzNZptkA0FHawsdZt/exec";
let _serverSeq = null; // 서버에서 받아온 현재 시퀀스

// ═══════════════════════════════════════════════
//  렌더링
// ═══════════════════════════════════════════════
function render(targetData = null) {
  const co = companies[currentCompany];
  const doc = document.getElementById('docArea');

  // 데이터 분리: 외부에서 전달된 데이터가 있으면 그것을 사용, 없으면 현재 화면 값을 수집
  const saved = targetData || collectValues();
  
  // 외부 데이터를 불러올 때만(예: 레이아웃 전환) rowCount 동기화
  if (targetData && saved.items && saved.items.length > 0) {
    rowCount = saved.items.length;
  }

  const today = new Date();
  const dateStr = `${today.getFullYear()}년 ${today.getMonth()+1}월 ${today.getDate()}일`;
  const noStr = getDisplayNo();

  if (currentLayout === 'A') {
    doc.innerHTML = renderLayoutA(co, dateStr, noStr, saved);
  } else {
    doc.innerHTML = renderLayoutB(co, dateStr, noStr, saved);
    calcBasis(); // 기술용역형인 경우 인건비 자동 계산 초기화
  }

  // 이벤트 재연결
  attachEvents();
  calcAll();
  updateLogo();
}

function updateLogo() {
  ['companyLogo','companyLogoB'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = LOGOS[currentCompany];
  });
  setTimeout(buildNavMap, 50);
  setTimeout(() => {
    paginatePages();
    positionFloatBtns();
  }, 100);
}

// ── 페이지 분할: 품목 행 또는 비고 내용 초과시 자동으로 다음 페이지 생성
function paginatePages() {
  const wrapper = document.getElementById('docWrapper');
  const page1 = document.getElementById('page1');
  if (!page1 || !wrapper) return;

  const itemTable = document.getElementById('itemTable');
  const tbody = document.getElementById('itemBody');
  const memoField = document.getElementById('memoField');
  const memoSection = memoField ? memoField.parentElement : null;
  const footer2Row = page1.querySelector('.footer-2row');
  
  if (!tbody) return;

  // 1. 기존에 생성된 추가 페이지들로부터 요소들을 원본 위치로 복구
  wrapper.querySelectorAll('.doc-page:not(#page1):not(#page2_labor):not(#page3_expenses):not(#pageSW)').forEach(p => {
    const dynamicTbody = p.querySelector('.dynamic-tbody');
    if (dynamicTbody) {
        while (dynamicTbody.firstChild) {
            tbody.appendChild(dynamicTbody.firstChild);
        }
    }
    const memo = p.querySelector('#memoField');
    if (memo && memoSection) {
        page1.insertBefore(memoSection, page1.querySelector('.page-num'));
    }
    const footer = p.querySelector('.footer-2row');
    if (footer && footer2Row) {
        page1.insertBefore(footer2Row, page1.querySelector('.page-num'));
    }
    p.remove();
  });

  const tfoot = itemTable ? itemTable.querySelector('tfoot') : null;

  // 모든 요소 초기화 및 표시 (계산을 위해)
  const allRows = Array.from(tbody.querySelectorAll('tr'));
  allRows.forEach(tr => { tr.style.display = ''; });
  if (tfoot) {
      tfoot.style.display = '';
      itemTable.appendChild(tfoot);
  }
  if (memoSection) {
      memoSection.style.display = '';
      page1.insertBefore(memoSection, page1.querySelector('.page-num'));
  }
  if (footer2Row) {
      footer2Row.style.display = '';
      page1.insertBefore(footer2Row, page1.querySelector('.page-num'));
  }

  const style = getComputedStyle(page1);
  const paddingTop = parseInt(style.paddingTop) || 0;
  const paddingBottom = parseInt(style.paddingBottom) || 0;
  
  const PAGE_HEIGHT = 1122; 
  const PAGE_CONTENT_H = PAGE_HEIGHT - paddingTop - paddingBottom - 20; 

  function getCurrentHeight(targetPage) {
    let h = 0;
    Array.from(targetPage.children).forEach(el => {
      if (el.classList.contains('page-num') || el.style.display === 'none') return;
      const s = getComputedStyle(el);
      h += el.offsetHeight + parseInt(s.marginTop || 0) + parseInt(s.marginBottom || 0);
    });
    return h;
  }

  // 1페이지가 넘지 않으면 종료
  if (getCurrentHeight(page1) <= PAGE_CONTENT_H) {
    document.getElementById('pageNum1').textContent = '- 1 -';
    if (currentLayout === 'B') paginateBreakdownB(2);
    else if (_showSWPage) {
       const pNum = document.getElementById('pageSW')?.querySelector('.page-num');
       if (pNum) pNum.textContent = '- 2 -';
    }
    return;
  }

  // 초과분 수집 및 1페이지에서 분리
  let itemsToMove = [];
  
  // 하단부터 역순으로 체크하여 초과분 분리
  if (footer2Row && getCurrentHeight(page1) > PAGE_CONTENT_H) {
      itemsToMove.unshift({type: 'footer', el: footer2Row});
      footer2Row.remove();
  }
  if (memoSection && getCurrentHeight(page1) > PAGE_CONTENT_H) {
      itemsToMove.unshift({type: 'memo', el: memoSection});
      memoSection.remove();
  }
  if (tfoot && getCurrentHeight(page1) > PAGE_CONTENT_H) {
      itemsToMove.unshift({type: 'tfoot', el: tfoot});
      tfoot.remove();
  }
  
  // 품목 행 체크
  while (allRows.length > 0 && getCurrentHeight(page1) > PAGE_CONTENT_H) {
      const lastRow = allRows.pop();
      itemsToMove.unshift({type: 'row', el: lastRow});
      lastRow.remove();
  }

  // 다음 페이지들 생성
  let currentPageNum = 1;
  while (itemsToMove.length > 0) {
    currentPageNum++;
    const newPage = document.createElement('div');
    newPage.className = 'doc-page';
    newPage.style.padding = style.padding;
    
    const tableHtml = `
      <table class="item-tbl" style="margin-bottom:0">
        ${itemTable.querySelector('thead').outerHTML}
        <tbody class="dynamic-tbody"></tbody>
      </table>
      <div class="page-num">- ${currentPageNum} -</div>
    `;
    newPage.innerHTML = tableHtml;
    
    const laborPage = document.getElementById('page2_labor');
    if (laborPage && currentLayout === 'B') {
        wrapper.insertBefore(newPage, laborPage);
    } else {
        wrapper.appendChild(newPage);
    }

    const nextTbody = newPage.querySelector('.dynamic-tbody');
    const nextTable = newPage.querySelector('table');
    
    let processingItems = [...itemsToMove];
    itemsToMove = [];

    processingItems.forEach(item => {
        if (item.type === 'row') {
            nextTbody.appendChild(item.el);
            if (getCurrentHeight(newPage) > PAGE_CONTENT_H && nextTbody.children.length > 1) {
                itemsToMove.push(item);
                item.el.remove();
            }
        } else if (item.type === 'tfoot') {
            nextTable.appendChild(item.el);
            if (getCurrentHeight(newPage) > PAGE_CONTENT_H && nextTable.children.length > 1) {
                itemsToMove.push(item);
                item.el.remove();
            }
        } else if (item.type === 'memo' || item.type === 'footer') {
            newPage.insertBefore(item.el, newPage.querySelector('.page-num'));
            if (getCurrentHeight(newPage) > PAGE_CONTENT_H && newPage.children.length > 2) {
                itemsToMove.push(item);
                item.el.remove();
            }
        }
    });
    
    // 무한 루프 방지 (하나도 못 담은 경우)
    if (itemsToMove.length === processingItems.length && itemsToMove.length > 0) {
        const item = itemsToMove.shift();
        if (item.type === 'row') {
            nextTbody.appendChild(item.el);
        } else if (item.type === 'tfoot') {
            nextTable.appendChild(item.el);
        } else {
            newPage.insertBefore(item.el, newPage.querySelector('.page-num'));
        }
    }
  }

  document.getElementById('pageNum1').textContent = '- 1 -';
  if (currentLayout === 'B') {
    paginateBreakdownB(currentPageNum + 1);
  } else if (_showSWPage) {
    const pSW = document.getElementById('pageSW');
    if (pSW) {
      const pNum = pSW.querySelector('.page-num');
      if (pNum) pNum.textContent = `- ${currentPageNum + 1} -`;
    }
  }
}

function paginateBreakdownB(startPageNum) {
  let nextPnum = paginateSinglePageB('page2_labor', startPageNum);
  paginateSinglePageB('page3_expenses', nextPnum);
}

function paginateSinglePageB(pageId, startPageNum) {
  const page = document.getElementById(pageId);
  const wrapper = document.getElementById('docWrapper');
  if (!page || !wrapper) return startPageNum;

  const content = page.querySelector('.doc-content');
  const style = getComputedStyle(page);
  const paddingTop = parseInt(style.paddingTop) || 0;
  const paddingBottom = parseInt(style.paddingBottom) || 0;
  const PAGE_HEIGHT = 1122; 
  const PAGE_CONTENT_H = PAGE_HEIGHT - paddingTop - paddingBottom - 20;

  // 1. 기존 분할된 추가 페이지 제거 및 원본 페이지로 요소 복구
  wrapper.querySelectorAll(`.doc-page.extra-${pageId}`).forEach(p => {
    const extraContent = p.querySelector('.doc-content');
    if (extraContent) {
      while (extraContent.firstChild) {
        content.appendChild(extraContent.firstChild);
      }
    }
    p.remove();
  });

  let pNum = startPageNum;
  const pnumEl = page.querySelector('.page-num');
  if (pnumEl) pnumEl.textContent = `- ${pNum} -`;

  function getH(target) {
    let h = 0;
    Array.from(target.children).forEach(el => {
      const s = getComputedStyle(el);
      h += el.offsetHeight + parseInt(s.marginTop || 0) + parseInt(s.marginBottom || 0);
    });
    return h;
  }

  // 높이 체크하며 필요한 만큼 페이지로 이동
  let itemsToMove = [];
  while (getH(content) > PAGE_CONTENT_H && content.children.length > 1) {
    const el = content.lastElementChild;
    itemsToMove.unshift(el);
    el.remove();
  }

  let lastInsertedPage = page;
  while (itemsToMove.length > 0) {
    pNum++;
    const newPage = document.createElement('div');
    newPage.className = `doc-page labor-extra extra-${pageId}`;
    newPage.style.padding = style.padding;
    newPage.innerHTML = `<div class="doc-content" style="font-size:11px"></div><div class="page-num">- ${pNum} -</div>`;
    
    // 원본 페이지 바로 뒤에 삽입하여 순서 유지
    wrapper.insertBefore(newPage, lastInsertedPage.nextSibling);
    lastInsertedPage = newPage;
    
    const newContent = newPage.querySelector('.doc-content');
    let processingItems = [...itemsToMove];
    itemsToMove = [];

    processingItems.forEach(el => {
      newContent.appendChild(el);
      if (getH(newContent) > PAGE_CONTENT_H && newContent.children.length > 1) {
        const toMove = newContent.lastElementChild;
        itemsToMove.push(toMove);
        toMove.remove();
      }
    });

    if (itemsToMove.length === processingItems.length && itemsToMove.length > 0) {
        newContent.appendChild(itemsToMove.shift());
    }
  }
  return pNum;
}

// ── 플로팅 행 버튼: doc-wrapper 왼쪽 여백에 배치
function positionFloatBtns() {
  const wrapper = document.getElementById('docWrapper');
  const table   = document.getElementById('itemTable');
  const main    = document.querySelector('.main');
  if (!wrapper || !main) return;

  let panel = document.getElementById('floatRowBtns');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'floatRowBtns';

    const btnAdd = document.createElement('button');
    btnAdd.className = 'row-btn add';
    btnAdd.innerHTML = '＋ 행 추가';
    btnAdd.onclick = addRow;

    const btnDel = document.createElement('button');
    btnDel.className = 'row-btn del';
    btnDel.innerHTML = '－ 행 삭제';
    btnDel.onclick = delRow;

    panel.appendChild(btnAdd);
    panel.appendChild(btnDel);
    main.appendChild(panel);
  }

  // wrapper 기준 top: 테이블이 있으면 테이블 위치, 없으면 wrapper 상단
  const mainRect    = main.getBoundingClientRect();
  const targetRect  = (table || wrapper).getBoundingClientRect();
  const wrapperRect = wrapper.getBoundingClientRect();

  const relTop  = targetRect.top - mainRect.top + main.scrollTop;
  // 버튼 패널을 doc-wrapper 왼쪽 바깥(0~70px 영역)에 배치
  const relLeft = wrapperRect.left - mainRect.left - 76;

  panel.style.top  = Math.max(0, relTop) + 'px';
  panel.style.left = Math.max(0, relLeft) + 'px';

  // 2. 직접경비 (Section 2)용 버튼 패널
  const expTable = document.getElementById('expenseTableB');
  if (expTable) {
    let expPanel = document.getElementById('floatExpBtns');
    if (!expPanel) {
      expPanel = document.createElement('div');
      expPanel.id = 'floatExpBtns';
      expPanel.innerHTML = `
        <button class="row-btn add" onclick="addExpRowB()">＋ 행 추가</button>
        <button class="row-btn del" onclick="delExpRowB()">－ 행 삭제</button>
      `;
      main.appendChild(expPanel);
    }
    const expRect = expTable.getBoundingClientRect();
    const relExpTop = expRect.top - mainRect.top + main.scrollTop;
    const relExpLeft = wrapperRect.left - mainRect.left - 76;
    expPanel.style.top = Math.max(0, relExpTop) + 'px';
    expPanel.style.left = Math.max(0, relExpLeft) + 'px';
    expPanel.style.display = 'flex';
  } else {
    const expPanel = document.getElementById('floatExpBtns');
    if (expPanel) expPanel.style.display = 'none';
  }

  // 3. SW 단가표용 버튼 패널
  const swTable = document.querySelector('#pageSW .item-tbl');
  if (swTable && _showSWPage) {
    let swPanel = document.getElementById('floatSWBtns');
    if (!swPanel) {
      swPanel = document.createElement('div');
      swPanel.id = 'floatSWBtns';
      swPanel.innerHTML = `
        <button class="row-btn add" onclick="addSWRow()">＋ 행 추가</button>
        <button class="row-btn del" onclick="delSWRow()">－ 행 삭제</button>
      `;
      main.appendChild(swPanel);
    }
    const swRect = swTable.getBoundingClientRect();
    const relSWTop = swRect.top - mainRect.top + main.scrollTop;
    const relSWLeft = wrapperRect.left - mainRect.left - 76;
    swPanel.style.top = Math.max(0, relSWTop) + 'px';
    swPanel.style.left = Math.max(0, relSWLeft) + 'px';
    swPanel.style.display = 'flex';
  } else {
    const swPanel = document.getElementById('floatSWBtns');
    if (swPanel) swPanel.style.display = 'none';
  }
}

window.addEventListener('resize', positionFloatBtns);
window.addEventListener('scroll', positionFloatBtns);

// ── 레이아웃 A (1번·3번 스타일) ────────────────
function renderLayoutA(co, dateStr, noStr, saved) {
  const rows = buildRowsA(saved.items || []);
  const memo = saved.memo !== undefined ? saved.memo : defaultMemo;
  const p1 = buildPageA(co, dateStr, noStr, saved, rows, memo);
  
  let p2 = "";
  if (_showSWPage) {
    p2 = buildSWDiscountPage(saved);
  }
  
  return `<div class="doc-wrapper" id="docWrapper">${p1}${p2}</div>`;
}

function buildPageA(co, dateStr, noStr, saved, rows, memo) {
  return `
    <div class="doc-page" id="page1">

      <!-- NO + 제목 -->
      <div style="text-align:right;font-size:11px;color:var(--text-sub);margin-bottom:4px">NO. <strong id="displayNo">${noStr}</strong></div>
      <div class="doc-title" style="margin-bottom:18px">견 적 서</div>

      <!-- 헤더: 수신부 + 공급자 -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;gap:20px">

        <!-- 수신부 -->
        <div style="flex:1">
          <div class="date-line" style="margin-bottom:12px">
            견적일 :
            <input id="quoteDate" class="nav-cell" value="${dateStr}" style="border:none;border-bottom:1px solid #bbb;font-size:11.5px;width:130px;font-family:inherit;outline:none;background:transparent;padding:1px 4px">
          </div>
          <div style="display:flex;align-items:flex-end;gap:6px;margin-bottom:8px">
            <textarea id="clientName" class="nav-cell" rows="1" style="border:none;border-bottom:2px solid var(--text);font-family:'Noto Sans KR',sans-serif;font-size:18px;font-weight:700;width:216px;outline:none;background:transparent;resize:none;overflow:hidden;line-height:1.4;vertical-align:bottom;padding:0" oninput="autoResize(this)" placeholder="협력사명 기재"></textarea>
            <span style="font-size:14px;font-weight:500;color:var(--text-sub);align-self:flex-end">귀하</span>
          </div>
          <div style="font-size:11.5px;color:var(--text-sub);line-height:1.9">
            <div>참조 : <input id="refName" class="nav-cell hint-bg"  style="border:none;outline:none;font-family:inherit;font-size:11.5px;background:transparent;width:180px"></div>
            <div><input id="refTel" class="nav-cell hint-bg"  style="border:none;outline:none;font-family:inherit;font-size:11.5px;background:transparent;width:180px;padding-left:38px"></div>
            <div style="margin-top:6px">아래와 같이 견적 합니다.</div>
          </div>
        </div>

        <!-- 공급자 -->
        <div style="border:1.5px solid var(--border)">
          <div style="padding:8px 12px;border-bottom:1.5px solid var(--border);display:flex;align-items:center">
            <span id="companyLogo">LOGO</span>
          </div>
          <table class="supplier-tbl">
            <tr>
              <td class="vert" rowspan="5">공급자</td>
              <td class="lbl">사업자등록번호</td>
              <td colspan="2" style="font-size:11.5px">${co.regNo}</td>
            </tr>
            <tr>
              <td class="lbl">상&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;호</td>
              <td colspan="2">${co.corp}</td>
            </tr>
                        <tr>
              <td class="lbl">대&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;표</td>
              <td colspan="2" style="position:relative;">
                ${co.ceo}
                <img src="${co.stamp}" alt="인감" style="position:absolute;width:64px;height:64px;top:0;right:5px;transform:translateY(-50%);mix-blend-mode:multiply;opacity:0.9;z-index:10;pointer-events:none;">
              </td>
            </tr>
            <tr>
              <td class="lbl">소&nbsp;&nbsp;&nbsp;재&nbsp;&nbsp;&nbsp;지</td>
              <td colspan="2">${co.address}</td>
            </tr>
            <tr>
              <td class="lbl">업태/업종</td>
              <td colspan="2" style="font-size:11px">${co.bizType}</td>
            </tr>
            <tr>
              <td style="border:none;background:#f0ede8;width:22px"></td>
              <td class="lbl">담&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;당&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;자</td>
              <td colspan="2"><input id="contactPerson" class="nav-cell" value="${co.contact}" style="border:none;outline:none;font-family:inherit;font-size:11.5px;background:transparent;width:100%"></td>
            </tr>
          </table>
        </div>
      </div>

      <!-- 사업명 -->
      <div style="border:1px solid var(--border);padding:7px 14px;margin-bottom:14px;display:flex;align-items:flex-start;gap:10px">
        <span style="font-size:13px;font-weight:700;color:var(--text-sub);white-space:nowrap;padding-top:3px">사업명 :</span>
        <textarea id="projectName" class="auto-textarea" style="font-size:13px;font-weight:600;min-height:32px;padding:0;border:none;background:transparent;line-height:1.5" placeholder="과업지시서 또는 공고문상의 정식명칭 기재" maxlength="120" oninput="wrapProjectName(this);autoResize(this)">${saved.projectName||''}</textarea>
      </div>

      <!-- 품목 테이블 -->
      <table class="item-tbl" id="itemTable" style="margin-bottom:0">
        <thead>
          <tr>
            <th style="width:30px">No.</th>
            <th>품명</th>
            <th style="width:46px">단위</th>
            <th style="width:58px">수량</th>
            <th style="width:108px">단가(원)</th>
            <th style="width:115px">금액(원)</th>
            <th style="width:86px">비고</th>
          </tr>
        </thead>
        <tbody id="itemBody">
          ${rows}
        </tbody>
        ${buildSummaryA(saved)}
      </table>

      <!-- 비고 -->
      <div style="margin-top:14px">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px">
          <div style="font-weight:700;font-size:12px">비고</div>
          <div class="no-print" style="display:flex; align-items:center; gap:8px">
            <span style="font-size:11px; color:var(--text-sub)">SW 수량별 단가표</span>
            <div class="sw-toggle-btns">
              <button class="btn-sw-opt ${!_showSWPage ? 'active' : ''}" onclick="toggleSWDiscountPage(false)">끄기</button>
              <button class="btn-sw-opt ${_showSWPage ? 'active' : ''}" onclick="toggleSWDiscountPage(true)">켜기</button>
            </div>
          </div>
        </div>
        <textarea id="memoField" class="auto-textarea" oninput="autoResize(this)" placeholder="내용을 입력하세요">${memo}</textarea>
      </div>

      <!-- 하단 정보 2행 -->
      <table class="footer-2row">
        <tr>
          <td class="fl">결제정보</td>
          <td colspan="3"><input id="bankInfo" class="nav-cell" value="${co.bank}" style="border:none;outline:none;font-family:inherit;font-size:11.5px;background:transparent;width:100%"></td>
        </tr>
        <tr>
          <td class="fl">지불조건</td>
          <td><input id="payCondition" class="nav-cell" value="${co.payCondition}" style="border:none;outline:none;font-family:inherit;font-size:11.5px;background:transparent;width:120px"></td>
          <td class="fl">견적유효기간</td>
          <td><input id="validity" class="nav-cell" value="${co.validity}" style="border:none;outline:none;font-family:inherit;font-size:11.5px;background:transparent;width:150px"></td>
        </tr>
      </table>

      <div class="page-num" id="pageNum1">- 1 -</div>
    </div>`;
}

function buildSWDiscountPage(saved) {
  let swData = saved.swDiscounts;
  if (!swData || swData.length === 0) {
    swData = [{}, {}, {}, {}, {}, {}];
  }
  let rows = "";
  swData.forEach((d, i) => {
    const namePH = (i === 0) ? "제품명" : "";
    const periodPH = (i === 0) ? "예: 1년" : "";
    rows += `
      <tr>
        <td><input class="sw-name nav-cell" value="${d.name||''}" placeholder="${namePH}"></td>
        <td><input class="sw-period nav-cell" value="${d.period||''}" placeholder="${periodPH}"></td>
        <td><input class="sw-qty nav-cell" value="${d.qty||''}" style="text-align:right"></td>
        <td><input class="sw-price nav-cell" value="${d.price||''}" style="text-align:right"></td>
        <td><input class="sw-amount nav-cell" value="${d.amount||''}" style="text-align:right" readonly></td>
        <td><input class="sw-rate nav-cell" value="${d.rate||''}" style="text-align:right" oninput="calcSWRow(this)"></td>
        <td><input class="sw-real nav-cell" value="${d.real||''}" style="text-align:right"></td>
      </tr>
    `;
  });

  return `
    <div class="doc-page" id="pageSW" style="padding: 12mm 14mm 16mm;">
      <div class="doc-title" style="font-size:24px; margin-bottom:40px; margin-top:20px">SW 수량별 단가표 (상세)</div>
      
      <div style="font-weight:700; font-size:14px; margin-bottom:12px">❚ SW수량별 단가</div>
      <table class="item-tbl">
        <thead>
          <tr>
            <th>제품명</th>
            <th style="width:90px">기간</th>
            <th style="width:80px">수량(copy)</th>
            <th style="width:105px">단가(원)</th>
            <th style="width:110px">금액(원)</th>
            <th style="width:80px">할인율(%)</th>
            <th style="width:100px">실사용가능 수</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      
      <div style="margin-top:40px; font-size:12px; color:#666; line-height:1.6">
        <div style="font-weight:700; margin-bottom:5px">❚ 안내사항</div>
        <div>• 본 단가표는 수량 구간별 차등 할인율이 적용된 제안 가격입니다.</div>
        <div>• 대량 구매 또는 연간 계약 시 추가 협의가 가능합니다.</div>
      </div>

      <div class="page-num">- 2 -</div>
    </div>
  `;
}

function toggleSWDiscountPage(show) {
  _showSWPage = show;
  render();
}

function calcSWRow(input) {
  const tr = input.closest('tr');
  const qtyStr = tr.querySelector('.sw-qty').value;
  const priceStr = tr.querySelector('.sw-price').value;
  
  const qty = parseInt(qtyStr.replace(/,/g, '')) || 0;
  const price = parseInt(priceStr.replace(/,/g, '')) || 0;
  
  if (qty > 0 && price > 0) {
    const amount = qty * price;
    tr.querySelector('.sw-amount').value = amount.toLocaleString();
  } else {
    tr.querySelector('.sw-amount').value = '';
  }
}

function addSWRow() {
  const tbody = document.querySelector('#pageSW .item-tbl tbody');
  if (!tbody) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input class="sw-name nav-cell" placeholder="제품명"></td>
    <td><input class="sw-period nav-cell" placeholder="예: 1년"></td>
    <td><input class="sw-qty nav-cell" style="text-align:right"></td>
    <td><input class="sw-price nav-cell" style="text-align:right"></td>
    <td><input class="sw-amount nav-cell" style="text-align:right" readonly></td>
    <td><input class="sw-rate nav-cell" style="text-align:right" oninput="calcSWRow(this)"></td>
    <td><input class="sw-real nav-cell" style="text-align:right"></td>
  `;
  tbody.appendChild(tr);
  attachEvents(); // 이벤트 다시 연결
  buildNavMap();
}

function delSWRow() {
  const tbody = document.querySelector('#pageSW .item-tbl tbody');
  if (!tbody || tbody.children.length <= 1) return;
  tbody.removeChild(tbody.lastElementChild);
  buildNavMap();
}


// ── 레이아웃 B (기술용역형: 구분/단위/수량/단가/금액/비고) ─────
function renderLayoutB(co, dateStr, noStr, saved) {
  const rows = buildRowsB(saved);
  const memo = saved.memo !== undefined ? saved.memo : ''; 
  const p1 = buildPageB(co, dateStr, noStr, saved, rows, memo);
  const p2 = buildLaborCostPageB(saved);
  // doc-wrapper로 감싸서 좌우 정렬 및 레이아웃 유지
  return `<div class="doc-wrapper" id="docWrapper">${p1}${p2}</div>`;
}

function buildPageB(co, dateStr, noStr, saved, rows, memo) {
  return `
    <div class="doc-page" id="page1">
      <div class="doc-content">
        <div style="text-align:right;font-size:11px;color:var(--text-sub);margin-bottom:4px">NO. <strong id="displayNo">${noStr}</strong></div>
        <div class="doc-title" style="margin-bottom:18px">견&nbsp;&nbsp;적&nbsp;&nbsp;서</div>

        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;gap:20px">
          <!-- 수신자 정보 -->
          <div style="flex:1">
            <div class="date-line" style="margin-bottom:12px">
              견적일 : 
              <input id="quoteDate" class="nav-cell" value="${dateStr}" style="border:none;border-bottom:1px solid #bbb;font-size:11.5px;width:130px;font-family:inherit;outline:none;background:transparent;padding:1px 4px">
            </div>
            <div style="display:flex;align-items:flex-end;gap:6px;margin-bottom:8px">
              <textarea id="clientName" class="nav-cell" rows="1" style="border:none;border-bottom:2px solid var(--text);font-family:'Noto Sans KR',sans-serif;font-size:18px;font-weight:700;width:216px;outline:none;background:transparent;resize:none;overflow:hidden;line-height:1.4;vertical-align:bottom;padding:0" oninput="autoResize(this)" placeholder="협력사명 기재"></textarea>
              <span style="font-size:14px;font-weight:500;color:var(--text-sub);align-self:flex-end">귀하</span>
            </div>
            <div style="font-size:11.5px;color:var(--text-sub);line-height:1.9">
              <div>참조 : <input id="refName" class="nav-cell hint-bg"  style="border:none;outline:none;font-family:inherit;font-size:11.5px;background:transparent;width:180px"></div>
              <div><input id="refTel" class="nav-cell hint-bg"  style="border:none;outline:none;font-family:inherit;font-size:11.5px;background:transparent;width:180px;padding-left:38px"></div>
              <div style="margin-top:6px">아래와 같이 견적 합니다.</div>
            </div>
          </div>

          <!-- 공급자 -->
          <div style="border:1.5px solid var(--border)">
            <div style="padding:8px 12px;border-bottom:1.5px solid var(--border);display:flex;align-items:center">
              <span id="companyLogo">LOGO</span>
            </div>
            <table class="supplier-tbl">
              <tr>
                <td class="vert" rowspan="5">공급자</td>
                <td class="lbl">사업자등록번호</td>
                <td colspan="2" style="font-size:11.5px">${co.regNo}</td>
              </tr>
              <tr>
                <td class="lbl">상&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;호</td>
                <td colspan="2">${co.corp}</td>
              </tr>
              <tr>
                <td class="lbl">대&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;표</td>
                <td colspan="2" style="position:relative;">
                  ${co.ceo}
                  <img src="${co.stamp}" alt="인감" style="position:absolute;width:64px;height:64px;top:0;right:5px;transform:translateY(-50%);mix-blend-mode:multiply;opacity:0.9;z-index:10;pointer-events:none;">
                </td>
              </tr>
              <tr>
                <td class="lbl">소&nbsp;&nbsp;&nbsp;재&nbsp;&nbsp;&nbsp;지</td>
                <td colspan="2">${co.address}</td>
              </tr>
              <tr>
                <td class="lbl">업태/업종</td>
                <td colspan="2" style="font-size:11px">${co.bizType}</td>
              </tr>
              <tr>
                <td style="border:none;background:#f0ede8;width:22px"></td>
                <td class="lbl">담&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;당&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;자</td>
                <td colspan="2"><input id="contactPerson" class="nav-cell" value="${co.contact}" style="border:none;outline:none;font-family:inherit;font-size:11.5px;background:transparent;width:100%"></td>
              </tr>
            </table>
          </div>
        </div>

        <!-- 사업명 -->
        <div style="border:1px solid var(--border);padding:7px 14px;margin-bottom:14px;display:flex;align-items:flex-start;gap:10px">
          <span style="font-size:13px;font-weight:700;color:var(--text-sub);white-space:nowrap;padding-top:3px">사업명 :</span>
          <textarea id="projectName" class="auto-textarea" style="font-size:13px;font-weight:600;min-height:32px;padding:0;border:none;background:transparent;line-height:1.5" placeholder="과업지시서 또는 공고문상의 정식명칭 기재" maxlength="120" oninput="wrapProjectName(this);autoResize(this)">${saved.projectName||''}</textarea>
        </div>

        <!-- 품목 테이블 (기술용역형) -->
        <table class="item-tbl" id="itemTable" style="margin-bottom:0">
          <thead>
            <tr>
              <th style="width:30px">No.</th>
              <th style="width:180px">구분</th>
              <th style="width:50px">단위</th>
              <th style="width:58px">수량</th>
              <th style="width:108px">단가(원)</th>
              <th style="width:115px">금액(원)</th>
              <th>비고</th>
            </tr>
          </thead>
          <tbody id="itemBody">
            ${rows}
          </tbody>
          ${buildSummaryB(saved)}
        </table>

        <!-- 비고 -->
        <div style="margin-top:14px">
          <div style="font-weight:700;font-size:12px;margin-bottom:6px">비고</div>
          <textarea id="memoField" class="auto-textarea" oninput="autoResize(this)" placeholder="내용을 입력하세요">${memo}</textarea>
        </div>

        <!-- 하단 정보 2행 -->
        <table class="footer-2row">
          <tr>
            <td class="fl">결제정보</td>
            <td colspan="3"><input id="bankInfo" class="nav-cell" value="${co.bank}" style="border:none;outline:none;font-family:inherit;font-size:11.5px;background:transparent;width:100%"></td>
          </tr>
          <tr>
            <td class="fl">지불조건</td>
            <td><input id="payCondition" class="nav-cell" value="${co.payCondition}" style="border:none;outline:none;font-family:inherit;font-size:11.5px;background:transparent;width:120px"></td>
            <td class="fl">견적유효기간</td>
            <td><input id="validity" class="nav-cell" value="${co.validity}" style="border:none;outline:none;font-family:inherit;font-size:11.5px;background:transparent;width:150px"></td>
          </tr>
        </table>

      <div class="page-num" id="pageNum1">- 1 -</div>
    </div>
  </div>`;
}

// ── 기술용역형 2페이지 이후: 내역 상세 ─────
function buildLaborCostPageB(saved) {
  const lc = saved.laborCost || {};
  const exp = saved.expensesB || {};
  const oh = saved.overheadB || { rate: 110 };
  const tf = saved.techFeeB || { rate: 30 };
  const final = saved.finalB || {};
  
  const rule = saved.discountRuleB || '100000';
  let ruleText = '';
  if (rule === '100000') ruleText = '십만원 이하 절사';
  else if (rule === '10000') ruleText = '만원 이하 절사';
  else if (rule === '1000')  ruleText = '천원 이하 절사';
  else if (rule === '0')     ruleText = '';

  return `
  <div class="doc-page" id="page2_labor">
    <div class="doc-content" style="font-size:11px">
      
      <!-- 1. 직접인건비 -->
      <div class="section-title-box" style="margin-top:0"><span class="section-badge">1</span> 직접인건비</div>
      <table class="item-tbl breakdown-table" style="margin-bottom:15px">
        <thead>
          <tr style="background:#e0f2f1">
            <th style="width:100px">구분</th>
            <th style="width:70px">인원(명)</th>
            <th style="width:70px">참여기간(개월)</th>
            <th style="width:100px">단가</th>
            <th style="width:110px">실행금액(원)</th>
            <th style="width:100px">비고</th>
          </tr>
        </thead>
        <tbody id="laborDetailBody">
          <tr><td>수석연구원</td><td><input class="lc-val nav-cell" oninput="calcBreakdown()" value="${lc.p1||'0'}"></td><td><input class="lc-val nav-cell" oninput="calcBreakdown()" value="${lc.m1||'12'}"></td><td><input class="lc-val nav-cell right" oninput="calcBreakdown()" value="${lc.u1||'638,657'}"></td><td><input class="lc-val nav-cell right" readonly value="${lc.a1||'0'}"></td><td><input class="lc-val nav-cell" value="${lc.n1||''}"></td></tr>
          <tr><td>책임연구원</td><td><input class="lc-val nav-cell" oninput="calcBreakdown()" value="${lc.p2||'0'}"></td><td><input class="lc-val nav-cell" oninput="calcBreakdown()" value="${lc.m2||'12'}"></td><td><input class="lc-val nav-cell right" oninput="calcBreakdown()" value="${lc.u2||'522,115'}"></td><td><input class="lc-val nav-cell right" readonly value="${lc.a2||'0'}"></td><td><input class="lc-val nav-cell" value="${lc.n2||''}"></td></tr>
          <tr><td>선임연구원</td><td><input class="lc-val nav-cell" oninput="calcBreakdown()" value="${lc.p3||'0'}"></td><td><input class="lc-val nav-cell" oninput="calcBreakdown()" value="${lc.m3||'12'}"></td><td><input class="lc-val nav-cell right" oninput="calcBreakdown()" value="${lc.u3||'405,573'}"></td><td><input class="lc-val nav-cell right" readonly value="${lc.a3||'0'}"></td><td><input class="lc-val nav-cell" value="${lc.n3||''}"></td></tr>
          <tr><td>연구원</td><td><input class="lc-val nav-cell" oninput="calcBreakdown()" value="${lc.p4||'0'}"></td><td><input class="lc-val nav-cell" oninput="calcBreakdown()" value="${lc.m4||'12'}"></td><td><input class="lc-val nav-cell right" oninput="calcBreakdown()" value="${lc.u4||'284,254'}"></td><td><input class="lc-val nav-cell right" readonly value="${lc.a4||'0'}"></td><td><input class="lc-val nav-cell" value="${lc.n4||''}"></td></tr>
          <tr style="font-weight:700; background:#f5f5f5">
            <td colspan="4" style="text-align:center;">합계</td><td><input class="lc-total nav-cell right" style="color:#d32f2f; font-weight:700" readonly value="${lc.total||'0'}"></td><td></td></tr>
        </tbody>
      </table>

      <!-- 적용 인건비 -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin:15px 0 6px 0">
        <div style="font-weight:700">❚ 적용 인건비</div>
        <div style="font-size:10px; color:#666">(단위: 원, 1인 1일 기준)</div>
      </div>
      <table class="item-tbl applied-table" style="margin-bottom:15px">
        <thead>
          <tr style="background:#f5f5f5">
            <th style="width:25%">연구원</th>
            <th style="width:25%">선임연구원</th>
            <th style="width:25%">책임연구원</th>
            <th style="width:25%">수석연구원</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><input class="applied-val nav-cell right" readonly value="284,254"></td>
            <td><input class="applied-val nav-cell right" readonly value="405,573"></td>
            <td><input class="applied-val nav-cell right" readonly value="522,115"></td>
            <td><input class="applied-val nav-cell right" readonly value="638,657"></td>
          </tr>
        </tbody>
      </table>

      <!-- 참고: 인건비 산출근거 -->
      <div style="font-weight:700; margin-bottom:6px; margin-top:15px">❚ 참고: 인건비 산출근거</div>
      <table class="item-tbl" style="margin-bottom:6px">
        <thead>
          <tr style="background:#f5f5f5">
            <th rowspan="2" style="width:120px">구분</th>
            <th colspan="4">평균임금 (원)</th>
            <th rowspan="2">비고</th>
          </tr>
          <tr style="background:#f5f5f5">
            <th>25백분위(초급)</th><th>50백분위(중급)</th><th>75백분위(고급)</th><th>100백분위(특급)</th>
          </tr>
        </thead>
        <tbody id="basisBody">
          ${buildBasisRowsB(saved.basisRows)}
        </tbody>
        <tr style="background:#fff9c4; font-weight:700">
          <td>평균</td>
          <td class="basis-avg">284,254</td>
          <td class="basis-avg">405,573</td>
          <td class="basis-avg">522,115</td>
          <td class="basis-avg">638,657</td>
          <td></td>
        </tr>
      </table>
      <div style="font-size:8.5px; color:#666; margin-bottom:15px">
        주1) 자료 출처: 2025년 적용 SW기술자 평균임금, 한국소프트웨어산업협회<br>
        주2) 100백분위수는 50백분위수와 75백분위 값으로 보정하여 사용
      </div>

    </div>
    <div class="page-num" id="pageNum2">- 2 -</div>
  </div>

  <div class="doc-page" id="page3_expenses">
    <div class="doc-content" style="font-size:11px">

      <!-- 2. 직접경비 -->
      <div class="section-title-box">
        <span class="section-badge">2</span> 직접경비
      </div>
      <table class="item-tbl breakdown-table" id="expenseTableB" style="margin-bottom:15px">
        <thead>
          <tr style="background:#e0f2f1">
            <th style="width:70px">구분</th>
            <th style="width:120px">품목</th>
            <th>상세</th>
            <th style="width:50px">수량</th>
            <th style="width:90px">단가(원)</th>
            <th style="width:100px">소비자가(원)</th>
            <th style="width:80px">비고</th>
          </tr>
        </thead>
        <tbody id="expenseBodyB">
          ${buildExpenseRowsB(saved.expensesB_rows)}
        </tbody>
        <tfoot>
          <tr style="font-weight:700; background:#f5f5f5">
            <td colspan="5" style="text-align:center; color:#000">합계</td>
            <td><input class="exp-total nav-cell right" style="font-weight:700; color:#d32f2f" readonly value="${exp.total||'0'}"></td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      <!-- 3. 제경비 -->
      <div class="section-title-box"><span class="section-badge">3</span> 제경비 : <input class="oh-val section-amount" readonly value="${oh.total||'0'}"> 원</div>
      <div class="formula-text">직접인건비의 <input class="oh-rate formula-input" oninput="calcBreakdown()" value="${oh.rate||'110'}"> % 적용 (기준: 110%~120%)</div>

      <!-- 4. 기술료 -->
      <div class="section-title-box"><span class="section-badge">4</span> 기술료 : <input class="tf-val section-amount" readonly value="${tf.total||'0'}"> 원</div>
      <div class="formula-text">(직접인건비 + 제경비) x <input class="tf-rate formula-input" oninput="calcBreakdown()" value="${tf.rate||'30'}"> % 적용 (기준: 20%~40%)</div>

      <!-- 5. 합계 -->
      <div class="section-title-box"><span class="section-badge">5</span> 합계 : <input class="final-sum section-amount" readonly value="${final.sum||'0'}"> 원</div>
      <div class="formula-text">직접인건비 + 직접경비 + 제경비 + 기술료</div>

      <!-- 6. 부가가치세 -->
      <div class="section-title-box"><span class="section-badge">6</span> 부가가치세 : <input class="final-vat section-amount" readonly value="${final.vat||'0'}"> 원</div>
      <div class="formula-text">합계 x 10%</div>

      <!-- 7. 견적금액 -->
      <div class="section-title-box"><span class="section-badge">7</span> 견적금액 : <input class="final-total section-amount" readonly value="${final.total||'0'}"> 원</div>
      <div class="formula-text" style="margin-bottom:40px">일금 <span id="textAmountB">0</span> ≒ <input class="final-total formula-input" style="width:90px" readonly value="${final.total||'0'}"> <span id="discountTextB">(${ruleText})</span></div>
    </div>
    <div class="page-num" id="pageNum3">- 3 -</div>
  </div>`;
}

function buildExpenseRowsB(rows = []) {
  if (rows.length === 0) {
    // 초기 예시 데이터
    return `
      <tr>
        <td><input class="exp-cat nav-cell" value=""></td>
        <td><input class="exp-name nav-cell" value=""></td>
        <td><input class="exp-spec nav-cell" value=""></td>
        <td><input class="exp-qty nav-cell" oninput="calcBreakdown()" value="1"></td>
        <td><input class="exp-uprice nav-cell right" oninput="calcBreakdown()" value="0"></td>
        <td><input class="exp-val nav-cell right" readonly value="0"></td>
        <td><input class="exp-note nav-cell" value=""></td>
      </tr>
      <tr>
        <td><input class="exp-cat nav-cell" value=""></td>
        <td><input class="exp-name nav-cell" value=""></td>
        <td><input class="exp-spec nav-cell" value=""></td>
        <td><input class="exp-qty nav-cell" oninput="calcBreakdown()" value="1"></td>
        <td><input class="exp-uprice nav-cell right" oninput="calcBreakdown()" value="0"></td>
        <td><input class="exp-val nav-cell right" readonly value="0"></td>
        <td><input class="exp-note nav-cell" value=""></td>
      </tr>
      <tr>
        <td><input class="exp-cat nav-cell" value=""></td>
        <td><input class="exp-name nav-cell" value=""></td>
        <td><input class="exp-spec nav-cell" value=""></td>
        <td><input class="exp-qty nav-cell" oninput="calcBreakdown()" value="1"></td>
        <td><input class="exp-uprice nav-cell right" oninput="calcBreakdown()" value="0"></td>
        <td><input class="exp-val nav-cell right" readonly value="0"></td>
        <td><input class="exp-note nav-cell" value=""></td>
      </tr>
      <tr>
        <td><input class="exp-cat nav-cell" value=""></td>
        <td><input class="exp-name nav-cell" value=""></td>
        <td><input class="exp-spec nav-cell" value=""></td>
        <td><input class="exp-qty nav-cell" oninput="calcBreakdown()" value="1"></td>
        <td><input class="exp-uprice nav-cell right" oninput="calcBreakdown()" value="0"></td>
        <td><input class="exp-val nav-cell right" readonly value="0"></td>
        <td><input class="exp-note nav-cell" value=""></td>
      </tr>
    `;
  }
  return rows.map(r => `
    <tr>
      <td><input class="exp-cat nav-cell" value="${r.cat||''}"></td>
      <td><input class="exp-name nav-cell" value="${r.name||''}"></td>
      <td><input class="exp-spec nav-cell" value="${r.spec||''}"></td>
      <td><input class="exp-qty nav-cell" oninput="calcBreakdown()" value="${r.qty||'1'}"></td>
      <td><input class="exp-uprice nav-cell right" oninput="calcBreakdown()" value="${fmt(r.uprice)}"></td>
      <td><input class="exp-val nav-cell right" readonly value="${fmt(r.val)}"></td>
      <td><input class="exp-note nav-cell" value="${r.note||''}"></td>
    </tr>
  `).join('');
}

function buildBasisRowsB(rows) {
  const defaultBasis = [
    { title: 'IT기획자', v1: '382,762', v2: '562,993', v3: '861,867', v4: '1,160,741', n: '' },
    { title: 'IT컨설턴트', v1: '245,906', v2: '471,166', v3: '536,687', v4: '602,208', n: '정보보호컨설턴트' },
    { title: '업무분석가', v1: '393,290', v2: '436,765', v3: '484,501', v4: '532,237', n: '' },
    { title: '데이터분석가', v1: '286,364', v2: '376,271', v3: '473,463', v4: '570,655', n: '' },
    { title: 'IT PM', v1: '325,796', v2: '443,955', v3: '596,003', v4: '748,051', n: '' },
    { title: 'IT아키텍트', v1: '352,792', v2: '492,609', v3: '576,762', v4: '660,915', n: 'SW아키텍트, 데이터아키텍트, Infrastructure아키텍트, 데이터베이스아키텍트' },
    { title: 'UI/UX기획/개발자', v1: '203,098', v2: '326,566', v3: '412,481', v4: '498,396', n: 'UI/UX기획자, UI/UX개발자' },
    { title: 'UI/UX디자이너', v1: '166,546', v2: '251,272', v3: '407,614', v4: '563,956', n: '' },
    { title: '응용SW개발자', v1: '219,087', v2: '337,061', v3: '449,024', v4: '560,987', n: '빅데이터개발자, 인공지능개발자' },
    { title: '시스템SW개발자', v1: '198,151', v2: '296,070', v3: '350,864', v4: '405,658', n: '임베디드SW개발자' },
    { title: '정보시스템운용자', v1: '283,779', v2: '492,943', v3: '783,171', v4: '1,073,399', n: '데이터베이스운용자, NW엔지니어, IT시스템운용자' },
    { title: 'IT지원기술자', v1: '171,544', v2: '245,535', v3: '282,867', v4: '320,199', n: '' },
    { title: 'IT마케터', v1: '345,896', v2: '536,729', v3: '768,806', v4: '1,000,883', n: 'SW제품기획자, IT서비스기획자, IT기술영업' },
    { title: 'IT품질관리자', v1: '340,542', v2: '470,490', v3: '611,823', v4: '753,156', n: '' },
    { title: 'IT테스터', v1: '140,339', v2: '173,328', v3: '189,811', v4: '206,294', n: '' },
    { title: 'IT감리', v1: '439,246', v2: '502,494', v3: '551,942', v4: '601,390', n: '' },
    { title: '정보보안전문가', v1: '337,176', v2: '478,500', v3: '538,271', v4: '598,042', n: '정보보호관리자, 침해사고대응전문가' }
  ];
  const items = rows && rows.length > 0 ? rows : defaultBasis;
  return items.map(r => `
    <tr>
      <td>${r.title}</td>
      <td><input class="basis-val nav-cell" oninput="calcBasis()" value="${r.v1}"></td>
      <td><input class="basis-val nav-cell" oninput="calcBasis()" value="${r.v2}"></td>
      <td><input class="basis-val nav-cell" oninput="calcBasis()" value="${r.v3}"></td>
      <td><input class="basis-val nav-cell" oninput="calcBasis()" value="${r.v4}"></td>
      <td><textarea class="basis-note nav-cell auto-textarea" style="width:100%" oninput="autoResize(this)">${r.n}</textarea></td>
    </tr>
  `).join('');
}

// ── 행 빌더 ─────────────────────────────────────
function buildRowsA(items) {
  let html = '';
  for (let i = 0; i < rowCount; i++) {
    const it = items[i] || {};
    html += `<tr data-row="${i}">
      <td><input class="row-no nav-cell" value="${it.no||''}" style="width:28px"></td>
      <td class="name-cell"><input class="row-name left nav-cell" value="${it.name||''}" style="width:100%"></td>
      <td><input class="row-unit nav-cell" value="${it.unit||'식'}"></td>
      <td><input class="row-qty right nav-cell" value="${it.qty||''}" data-calc></td>
      <td><input class="row-price right nav-cell" value="${it.price||''}" data-calc></td>
      <td><input class="row-amount right" value="${it.amount||''}" readonly style="font-weight:600;color:var(--text-sub)"></td>
      <td><input class="row-note left nav-cell" value="${it.note||''}" style="width:100%"></td>
    </tr>`;
  }
  return html;
}

function buildRowsB(saved) {
  const items = saved.items || [];
  const coreNames = ['직접인건비', '직접경비', '제경비', '기술료'];
  const summaryNames = ['합계', '절사금액', '부가가치세', '견적금액'];
  const summaryNotes = ['①+②+③+④', '', '⑥의 x 10%', '⑥ + ⑦'];
  
  let html = '';
  // Data Rows
  for (let i = 0; i < rowCount; i++) {
    const it = items[i] || {};
    const no = it.no || (i < 4 ? (i + 1).toString() : '');
    const name = it.name || (i < 4 ? coreNames[i] : '');
    const unit = it.unit !== undefined ? it.unit : (i < 4 ? '식' : '');
    const qty  = it.qty  !== undefined ? it.qty  : (i < 4 ? '1' : '');
    const note = it.note || '';
    
    html += `<tr data-row="${i}">
      <td><input class="row-no nav-cell" value="${no}" style="width:28px"></td>
      <td class="name-cell"><input class="row-name left nav-cell" value="${name}" style="width:100%"></td>
      <td><input class="row-unit nav-cell" value="${unit}"></td>
      <td><input class="row-qty right nav-cell" value="${qty}" data-calc></td>
      <td><input class="row-price right nav-cell" value="${it.price||''}" data-calc></td>
      <td><input class="row-amount right" value="${it.amount||''}" style="font-weight:600;color:var(--text-sub)"></td>
      <td><input class="row-note left nav-cell" value="${note}" style="width:100%"></td>
    </tr>`;
  }
  // Summary Rows: Editable notes
  for (let i = 0; i < 4; i++) {
    const name = summaryNames[i];
    const defaultNote = summaryNotes[i];
    const savedNote = (saved.summaryNotes && saved.summaryNotes[i] !== undefined) ? saved.summaryNotes[i] : defaultNote;
    
    let amountClass = 'row-amount right';
    if (name === '합계') amountClass += ' b-subtotal';
    if (name === '절사금액') amountClass += ' b-discount';
    if (name === '부가가치세') amountClass += ' b-vat';
    if (name === '견적금액') amountClass += ' b-total';
    
    let noteCell = `<input class="row-note left nav-cell" value="${savedNote}" style="width:100%;font-size:11px;color:#666">`;
    if (currentLayout === 'B' && name === '절사금액') {
      const rule = saved.discountRuleB || '100000';
      noteCell = `
        <div style="display:flex; align-items:center; gap:8px">
          <select id="discountRuleB" onchange="calcAll()" class="print-as-text" style="font-size:10px; padding:1px; border:1px solid #ccc; border-radius:3px; color:#666">
            <option value="100000" ${rule==='100000'?'selected':''}>십만원 이하 절사</option>
            <option value="10000" ${rule==='10000'?'selected':''}>만원 이하 절사</option>
            <option value="1000" ${rule==='1000'?'selected':''}>천원 이하 절사</option>
            <option value="0" ${rule==='0'?'selected':''}>절사 없음</option>
          </select>
        </div>
      `;
    }

    html += `<tr class="summary-row ${name==='견적금액'?'final-total-row':''}" data-name="${name}" style="background:#f9f9f9">
      <td colspan="5" style="text-align:center;font-weight:700;color:#333">${name}</td>
      <td><input class="${amountClass}" readonly style="font-weight:700;color:#d32f2f;width:100%;border:none;background:transparent;text-align:right"></td>
      <td>${noteCell}</td>
    </tr>`;
  }
  return html;
}

function buildSummaryA(saved) {
  const d = saved.discount || ''; const vat = saved.vat || ''; const total = saved.total || '';
  return `<tfoot>
    <tr class="total-row"><td colspan="5" style="text-align:center">합계</td><td id="subTotal" class="right" style="text-align:right;padding-right:8px"></td><td></td></tr>
    <tr class="sum-row">
      <td colspan="5" style="text-align:center;font-weight:700">절사금액</td>
      <td style="text-align:right;padding-right:8px">
        <input id="discountVal" class="nav-cell right" oninput="calcAll()" value="${fmt(d)}" style="width:100%; font-weight:700; border:none; background:transparent; text-align:right; padding:0">
      </td>
      <td style="width:120px; padding-left:10px">
        <select id="discountRule" onchange="calcAll()" class="print-as-text" style="font-size:10px; padding:2px; border:1px solid #ccc; border-radius:3px; color:#666; background:#fff; outline:none; cursor:pointer">
          <option value="100000" ${saved.discountRule==='100000'?'selected':''}>십만원 이하 절사</option>
          <option value="10000" ${saved.discountRule==='10000'?'selected':''}>만원 이하 절사</option>
          <option value="1000" ${saved.discountRule==='1000'?'selected':''}>천원 이하 절사</option>
          <option value="0" ${saved.discountRule==='0'?'selected':''}>절사 없음</option>
        </select>
      </td>
    </tr>
    <tr class="sum-row"><td colspan="5" style="text-align:center;font-weight:700">부가가치세</td><td id="vatVal" style="text-align:right;padding-right:8px"></td><td></td></tr>
    <tr class="total-row final-total-row"><td colspan="5" style="text-align:center;font-size:13px">견적금액</td><td id="totalVal" style="text-align:right;padding-right:8px;font-size:13.5px"></td><td></td></tr>
  </tfoot>`;
}

function buildSummaryB(saved) {
  // 기술용역형은 본문 행에 소계/부가세/총액이 포함되므로 tfoot은 비워두거나 필요시 합산만 표시
  // 여기서는 사용자 요청에 따라 별도의 요약 행 없이 본문으로 처리하므로 빈 값 리턴
  return '';
}

// ═══════════════════════════════════════════════
//  계산
// ═══════════════════════════════════════════════
function parseNum(s) {
  return parseFloat(String(s).replace(/,/g,'')) || 0;
}
function fmt(n) {
  if (!n && n !== 0) return '';
  return Math.round(n).toLocaleString('ko-KR');
}

function calcAll() {
  // 모든 페이지의 품목 행 수집
  const allRows = Array.from(document.querySelectorAll('#itemBody tr, .dynamic-tbody tr'));
  let subTotal = 0;

  allRows.forEach(tr => {
    const qty   = parseNum(tr.querySelector('.row-qty')?.value);
    const price = parseNum(tr.querySelector('.row-price')?.value);
    const amtEl = tr.querySelector('.row-amount');
    const name  = tr.dataset.name || tr.querySelector('.row-name')?.value || '';
    
    // 기술용역형의 자동 계산 행(합계, 절사금액, 부가세, 견적금액)은 합산에서 일단 제외
    if (currentLayout === 'B' && ['합계','절사금액','부가가치세','견적금액'].includes(name)) {
      // 나중에 별도 계산
    } else {
      const amt = qty && price ? qty * price : 0;
      if (amtEl) {
        amtEl.value = amt ? fmt(amt) : '';
      }
      subTotal += amt;
    }
  });

  const discEl = document.getElementById('discountVal');
  const ruleEl = document.getElementById('discountRule');
  const rule   = ruleEl ? parseInt(ruleEl.value) : 100000;

  // 비고 칸 표시 제어 (절사 없음일 때 투명하게)
  if (ruleEl) {
    ruleEl.style.color = (rule === 0) ? 'transparent' : '#666';
  }

  let discounted;
  if (discEl && document.activeElement === discEl) {
    discounted = parseNum(discEl.value);
  } else {
    if (rule === 0) {
      discounted = subTotal;
    } else {
      discounted = Math.floor(subTotal / rule) * rule;
    }
    if (discEl) discEl.value = fmt(discounted);
  }

  const vat   = Math.round(discounted * 0.1);
  const total = discounted + vat;

  // 기술용역형(B) 전용: 본문 내 요약 행들에 값 주입
  if (currentLayout === 'B') {
    const vatB_raw = Math.round(subTotal * 0.1); // 단순 참조용 (필요시)
    const ruleElB = document.getElementById('discountRuleB');
    const ruleB   = ruleElB ? parseInt(ruleElB.value) : 100000;
    
    // Page 1 드롭다운 투명도 제어
    if (ruleElB) ruleElB.style.color = (ruleB === 0) ? 'transparent' : '#666';

    let ruleText = '';
    if (ruleB === 100000) ruleText = '십만원 이하 절사';
    else if (ruleB === 10000) ruleText = '만원 이하 절사';
    else if (ruleB === 1000)  ruleText = '천원 이하 절사';

    let roundedSubTotalB = (ruleB === 0) ? subTotal : Math.floor(subTotal / ruleB) * ruleB;
    let vatB_final = Math.round(roundedSubTotalB * 0.1);
    let totalB = roundedSubTotalB + vatB_final;

    // Page 2 (상세내역) 문구도 함께 업데이트
    const textPage2El = document.getElementById('discountTextB');
    if (textPage2El) {
      textPage2El.textContent = ruleB === 0 ? '' : `(${ruleText})`;
    }

    allRows.forEach(tr => {
      const name = tr.dataset.name || tr.querySelector('.row-name')?.value || '';
      const amtEl = tr.querySelector('.row-amount');
      if (name === '합계') {
        if (amtEl) amtEl.value = fmt(subTotal);
      } else if (name === '절사금액') {
        if (amtEl) amtEl.value = fmt(roundedSubTotalB);
      } else if (name === '부가가치세') {
        if (amtEl) amtEl.value = fmt(vatB_final);
      } else if (name === '견적금액') {
        if (amtEl) amtEl.value = fmt(totalB);
      }
    });
  }

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('subTotal',    fmt(subTotal));
  // set('discountVal', fmt(discounted)); // 위에서 직접 처리
  set('vatVal',      fmt(vat));
  set('totalVal',    fmt(total));
}

// ── 기술용역형 상세 내역 계산 및 동기화 ────────
function calcBreakdown() {
  const isB = currentLayout === 'B';
  if (!isB) return;

  // 1. 직접인건비 계산
  const laborBody = document.getElementById('laborDetailBody');
  let laborTotal = 0;
  if (laborBody) {
    const rows = laborBody.querySelectorAll('tr:not(:last-child)');
    rows.forEach(tr => {
      const inputs = tr.querySelectorAll('input');
      const p = parseNum(inputs[0].value);
      const m = parseNum(inputs[1].value);
      const u = parseNum(inputs[2].value);
      const amt = Math.round(p * m * u);
      inputs[3].value = fmt(amt);
      laborTotal += amt;
    });
    const lcTotalInput = laborBody.querySelector('.lc-total');
    if (lcTotalInput) lcTotalInput.value = fmt(laborTotal);
  }

  // 2. 직접경비 계산
  const expBody = document.getElementById('expenseBodyB');
  let expenseTotal = 0;
  if (expBody) {
    const rows = expBody.querySelectorAll('tr');
    rows.forEach(tr => {
      const q = parseNum(tr.querySelector('.exp-qty')?.value);
      const u = parseNum(tr.querySelector('.exp-uprice')?.value);
      const amt = Math.round(q * u);
      const amtEl = tr.querySelector('.exp-val');
      if (amtEl) amtEl.value = fmt(amt);
      expenseTotal += amt;
    });
    document.querySelectorAll('.exp-total').forEach(el => el.value = fmt(expenseTotal));
  }

  // 3. 제경비 계산
  const ohRate = parseNum(document.querySelector('.oh-rate')?.value) / 100;
  const ohTotal = Math.round(laborTotal * ohRate);
  document.querySelectorAll('.oh-val').forEach(el => el.value = fmt(ohTotal));

  // 4. 기술료 계산
  const tfRate = parseNum(document.querySelector('.tf-rate')?.value) / 100;
  const tfTotal = Math.round((laborTotal + ohTotal) * tfRate);
  document.querySelectorAll('.tf-val').forEach(el => el.value = fmt(tfTotal));

  // 5. 합계 (공급가액) 및 절사 규칙 적용
  const grandSumRaw = laborTotal + expenseTotal + ohTotal + tfTotal;
  const ruleEl = document.getElementById('discountRuleB');
  const rule = ruleEl ? parseInt(ruleEl.value) : 100000;
  
  let roundedSum;
  if (rule === 0) {
    roundedSum = grandSumRaw;
  } else {
    roundedSum = Math.floor(grandSumRaw / rule) * rule;
  }
  document.querySelectorAll('.final-sum').forEach(el => el.value = fmt(roundedSum));

  // 6. 부가가치세 (절사된 합계의 10%)
  const vat = Math.round(roundedSum * 0.1);
  document.querySelectorAll('.final-vat').forEach(el => el.value = fmt(vat));

  // 7. 견적금액 (합계 + 부가가치세)
  const totalWithVat = roundedSum + vat;
  document.querySelectorAll('.final-total').forEach(el => el.value = fmt(totalWithVat));

  // 절사 안내 문구 업데이트 (Page 2)
  const textEl = document.getElementById('discountTextB');
  if (textEl) {
    let ruleText = '';
    if (rule === 100000) ruleText = '(십만원 이하 절사)';
    else if (rule === 10000) ruleText = '(만원 이하 절사)';
    else if (rule === 1000)  ruleText = '(천원 이하 절사)';
    textEl.textContent = ruleText;
  }
  
  const textAmountB = document.getElementById('textAmountB');
  if (textAmountB) {
    textAmountB.textContent = numberToKorean(totalWithVat);
  }

  // 1페이지 동기화
  syncToPage1B(laborTotal, expenseTotal, ohTotal, tfTotal);
}

function numberToKorean(num) {
  const numStr = String(num);
  const hanA = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
  const danA = ["", "십", "백", "천"];
  const danG = ["", "만", "억", "조"];
  let result = "";
  for (let i = 0; i < numStr.length; i++) {
    let str = "";
    let n = parseInt(numStr.charAt(i));
    if (n > 0) {
      str += hanA[n];
      str += danA[(numStr.length - i - 1) % 4];
    }
    if ((numStr.length - i - 1) % 4 === 0 && numStr.length - i - 1 !== 0) {
      let block = numStr.substring(Math.max(0, i - 3), i + 1);
      if (parseInt(block) > 0) {
        str += danG[(numStr.length - i - 1) / 4];
      }
    }
    result += str;
  }
  if (!result) return "영 원정";
  return result + "원정";
}

function syncToPage1B(l, e, o, t) {
  const rows = document.querySelectorAll('#itemBody tr');
  rows.forEach(tr => {
    const name = tr.querySelector('.row-name')?.value || '';
    const priceEl = tr.querySelector('.row-price');
    const amtEl = tr.querySelector('.row-amount');
    
    if (name === '직접인건비') {
      if (priceEl) priceEl.value = fmt(l);
      if (amtEl) amtEl.value = fmt(l);
    } else if (name === '직접경비') {
      if (priceEl) priceEl.value = fmt(e);
      if (amtEl) amtEl.value = fmt(e);
    } else if (name === '제경비') {
      if (priceEl) priceEl.value = fmt(o);
      if (amtEl) amtEl.value = fmt(o);
    } else if (name === '기술료') {
      if (priceEl) priceEl.value = fmt(t);
      if (amtEl) amtEl.value = fmt(t);
    }
  });
  calcAll();
}

function addExpRowB() {
  const body = document.getElementById('expenseBodyB');
  if (!body) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input class="exp-cat nav-cell"></td>
    <td><input class="exp-name nav-cell"></td>
    <td><input class="exp-spec nav-cell"></td>
    <td><input class="exp-qty nav-cell" oninput="calcBreakdown()" value="1"></td>
    <td><input class="exp-uprice nav-cell right" oninput="calcBreakdown()" value=""></td>
    <td><input class="exp-val nav-cell right" readonly value=""></td>
    <td><input class="exp-note nav-cell"></td>
  `;
  body.appendChild(tr);
  attachEvents();
  calcBreakdown();
  positionFloatBtns();
  setTimeout(() => paginateBreakdownB(document.querySelectorAll('.doc-page').length), 50);
}

function delExpRowB() {
  const body = document.getElementById('expenseBodyB');
  if (!body || body.rows.length <= 1) return; // 최소 1행 유지
  body.deleteRow(-1);
  calcBreakdown();
  positionFloatBtns();
  setTimeout(() => paginateBreakdownB(document.querySelectorAll('.doc-page').length), 50);
}

// ═══════════════════════════════════════════════
//  이벤트
// ═══════════════════════════════════════════════
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

function wrapProjectName(el) {
  // 줄당 30자 자동 줄바꿈
  const lines = el.value.split('\n');
  const wrapped = lines.map(line => {
    if (line.length <= 30) return line;
    let result = '';
    for (let i = 0; i < line.length; i += 30) {
      result += (i > 0 ? '\n' : '') + line.slice(i, i+30);
    }
    return result;
  });
  const newVal = wrapped.join('\n');
  if (newVal !== el.value) {
    const pos = el.selectionStart;
    el.value = newVal;
    el.setSelectionRange(pos, pos);
  }
}

function attachEvents() {
  // 수량/단가 콤마 포맷 + 계산
  document.querySelectorAll('.row-qty, .row-price, .exp-qty, .exp-uprice, .sw-qty, .sw-price').forEach(el => {
    el.addEventListener('input', () => {
      const raw = el.value.replace(/,/g,'');
      if (!isNaN(raw) && raw !== '') el.value = parseFloat(raw).toLocaleString('ko-KR');
      
      if (el.classList.contains('exp-qty') || el.classList.contains('exp-uprice')) {
        calcBreakdown();
      } else if (el.classList.contains('sw-qty') || el.classList.contains('sw-price')) {
        calcSWRow(el);
      } else {
        calcAll();
      }
    });
    el.addEventListener('blur', () => {
      if (el.classList.contains('exp-qty') || el.classList.contains('exp-uprice')) {
        calcBreakdown();
      } else if (el.classList.contains('sw-qty') || el.classList.contains('sw-price')) {
        calcSWRow(el);
      } else {
        calcAll();
      }
    });
  });

  // auto-textarea 높이
  document.querySelectorAll('.auto-textarea').forEach(el => {
    autoResize(el);
    el.addEventListener('input', () => autoResize(el));
  });

  // ── 방향키 네비게이션 ──────────────────────────
  buildNavMap();
  document.querySelectorAll('.nav-cell').forEach(el => {
    el.addEventListener('keydown', handleNavKey);
  });
}

// 네비게이션 맵: 모든 .nav-cell을 수집해서 위치 기반 그리드로 구성
let navMap = [];
function buildNavMap() {
  navMap = [];
  const cells = Array.from(document.querySelectorAll('.nav-cell'));
  cells.forEach((el, idx) => {
    el.dataset.navIdx = idx;
  });
  navMap = cells;
}

function handleNavKey(e) {
  const cells = navMap;
  const idx = parseInt(this.dataset.navIdx);
  if (isNaN(idx)) return;

  // 품목 테이블 행/열 구조 파악
  const tr = this.closest('tr');
  const trs = tr ? Array.from(tr.parentElement.querySelectorAll('tr')) : null;
  const trIdx = trs ? trs.indexOf(tr) : -1;
  const tdCells = tr ? Array.from(tr.querySelectorAll('.nav-cell')) : null;
  const colIdx = tdCells ? tdCells.indexOf(this) : -1;

  if (e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey)) {
    e.preventDefault();
    const next = cells[idx + 1];
    if (next) { next.focus(); next.select && next.select(); }
  } else if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) {
    e.preventDefault();
    const prev = cells[idx - 1];
    if (prev) { prev.focus(); prev.select && prev.select(); }
  } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
    e.preventDefault();
    if (trs && trIdx >= 0 && colIdx >= 0) {
      const nextTr = trs[trIdx + 1];
      if (nextTr) {
        const nextCells = Array.from(nextTr.querySelectorAll('.nav-cell'));
        const target = nextCells[colIdx] || nextCells[nextCells.length - 1];
        if (target) { target.focus(); target.select && target.select(); }
        return;
      }
    }
    const next = cells[idx + 1];
    if (next) { next.focus(); next.select && next.select(); }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (trs && trIdx > 0 && colIdx >= 0) {
      const prevTr = trs[trIdx - 1];
      if (prevTr) {
        const prevCells = Array.from(prevTr.querySelectorAll('.nav-cell'));
        const target = prevCells[colIdx] || prevCells[prevCells.length - 1];
        if (target) { target.focus(); target.select && target.select(); }
        return;
      }
    }
    const prev = cells[idx - 1];
    if (prev) { prev.focus(); prev.select && prev.select(); }
  }
}

// ═══════════════════════════════════════════════
//  값 수집
// ═══════════════════════════════════════════════

function collectValues() {
  // 모든 페이지의 품목 수집
  const items = [];
  document.querySelectorAll('#itemBody tr, .dynamic-tbody tr').forEach((tr, i) => {
    if (tr.classList.contains('summary-row')) return;
    items.push({
      no:     tr.querySelector('.row-no')?.value || '',
      name:   tr.querySelector('.row-name')?.value || '',
      spec:   tr.querySelector('.row-spec')?.value || '',
      unit:   tr.querySelector('.row-unit')?.value || '',
      qty:    tr.querySelector('.row-qty')?.value || '',
      price:  tr.querySelector('.row-price')?.value || '',
      amount: tr.querySelector('.row-amount')?.value || '',
      note:   tr.querySelector('.row-note')?.value || '',
    });
  });

  const summaryNotes = [];
  document.querySelectorAll('.summary-row .row-note').forEach(input => {
    summaryNotes.push(input.value);
  });
  // 기술용역형 전용 데이터 수집
  let laborCost = {};
  let expensesB = {};
  let expensesB_rows = [];
  let overheadB = {};
  let techFeeB = {};
  let finalB = {};
  let basisRows = [];

  if (currentLayout === 'B') {
    const lb = document.getElementById('laborDetailBody');
    if (lb) {
      const inputs = lb.querySelectorAll('input');
      if (inputs.length >= 21) {
        laborCost = {
          p1: inputs[0].value, m1: inputs[1].value, u1: inputs[2].value, a1: inputs[3].value, n1: inputs[4].value,
          p2: inputs[5].value, m2: inputs[6].value, u2: inputs[7].value, a2: inputs[8].value, n2: inputs[9].value,
          p3: inputs[10].value, m3: inputs[11].value, u3: inputs[12].value, a3: inputs[13].value, n3: inputs[14].value,
          p4: inputs[15].value, m4: inputs[16].value, u4: inputs[17].value, a4: inputs[18].value, n4: inputs[19].value,
          total: inputs[20].value
        };
      }
    } else if (dataB && dataB.laborCost) {
      laborCost = dataB.laborCost;
    }
    const eb = document.getElementById('expenseBodyB');

  // SW 수량별 단가표 데이터 수집
  const swDiscounts = [];
  const swPage = document.getElementById('pageSW');
  if (swPage) {
    swPage.querySelectorAll('tbody tr').forEach(tr => {
      swDiscounts.push({
        cat:   tr.querySelector('.sw-cat')?.value || '',
        range: tr.querySelector('.sw-range')?.value || '',
        base:  tr.querySelector('.sw-base')?.value || '',
        rate:  tr.querySelector('.sw-rate')?.value || '',
        final: tr.querySelector('.sw-final')?.value || '',
        note:  tr.querySelector('.sw-note')?.value || '',
      });
    });
  }
    if (eb) {
      expensesB_rows = Array.from(eb.querySelectorAll('tr')).map(tr => ({
        cat: tr.querySelector('.exp-cat')?.value || '',
        name: tr.querySelector('.exp-name')?.value || '',
        spec: tr.querySelector('.exp-spec')?.value || '',
        val: parseNum(tr.querySelector('.exp-val')?.value),
        note: tr.querySelector('.exp-note')?.value || ''
      }));
      expensesB.total = document.querySelector('.exp-total')?.value || '0';
    } else if (dataB && dataB.expensesB_rows) {
      expensesB_rows = dataB.expensesB_rows;
      expensesB.total = dataB.expensesB.total;
    }
    overheadB = {
      rate: document.querySelector('.oh-rate')?.value || '110',
      total: document.querySelector('.oh-val')?.value || '0'
    };
    techFeeB = {
      rate: document.querySelector('.tf-rate')?.value || '30',
      total: document.querySelector('.tf-val')?.value || '0'
    };
    finalB = {
      sum: document.querySelector('.final-sum')?.value || '0',
      vat: document.querySelector('.final-vat')?.value || '0',
      total: document.querySelector('.final-total')?.value || '0'
    };
    const basisB = document.getElementById('basisBody');
    if (basisB) {
      basisRows = Array.from(basisB.querySelectorAll('tr:not(:last-child)')).map(tr => ({
        title: tr.cells[0].textContent,
        v1: tr.querySelectorAll('.basis-val')[0]?.value || '0',
        v2: tr.querySelectorAll('.basis-val')[1]?.value || '0',
        v3: tr.querySelectorAll('.basis-val')[2]?.value || '0',
        v4: tr.querySelectorAll('.basis-val')[3]?.value || '0',
        n: tr.querySelector('.basis-note')?.value || ''
      }));
    } else if (dataB && dataB.basisRows) {
      // DOM에 없으면 기존 저장된 데이터 유지 (데이터 소실 방지)
      basisRows = dataB.basisRows;
    }
  }

  const swDiscounts = [];
  const swRows = document.querySelectorAll('#pageSW tbody tr');
  if (swRows.length > 0) {
    swRows.forEach(tr => {
      swDiscounts.push({
        name:   tr.querySelector('.sw-name')?.value || '',
        period: tr.querySelector('.sw-period')?.value || '',
        qty:    tr.querySelector('.sw-qty')?.value || '',
        price:  tr.querySelector('.sw-price')?.value || '',
        amount: tr.querySelector('.sw-amount')?.value || '',
        rate:   tr.querySelector('.sw-rate')?.value || '',
        real:   tr.querySelector('.sw-real')?.value || ''
      });
    });
  } else if (dataA && dataA.swDiscounts) {
    swDiscounts.push(...dataA.swDiscounts);
  }

  return {
    items,
    summaryNotes,
    laborCost, expensesB, expensesB_rows, overheadB, techFeeB, finalB, basisRows,
    projectName:  document.getElementById('projectName')?.value || '',
    clientName:   document.getElementById('clientName')?.value  || '',
    quoteDate:    document.getElementById('quoteDate')?.value   || '',
    refName:      document.getElementById('refName')?.value     || '',
    refTel:       document.getElementById('refTel')?.value      || '',
    contactPerson:document.getElementById('contactPerson')?.value || '',
    bankInfo:     document.getElementById('bankInfo')?.value    || '',
    payCondition: document.getElementById('payCondition')?.value || '',
    validity:     document.getElementById('validity')?.value    || '',
    memo:         document.getElementById('memoField')?.value   || '',
    discountRule: document.getElementById('discountRule')?.value  || '100000',
    discountRuleB:document.getElementById('discountRuleB')?.value || '100000',
    swDiscounts
  };
}


// ═══════════════════════════════════════════════
//  스위치
// ═══════════════════════════════════════════════
const LOGOS = {
  baron: '<img src="data:image/png;base64,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" alt="(주)바론컨설턴트" style="height:36px;object-fit:contain;display:block">',
  jh:    '<img src="images/(주)장헌CI_가로형-kr-2.png" alt="주식회사 장헌" style="height:36px;object-fit:contain;display:block">'
};

function switchCompany(c) {
  currentCompany = c;
  const sel = document.getElementById('companySelect');
  if (sel) sel.value = c;
  render();
}
function switchLayout(l) {
  // 1. 현재 레이아웃의 데이터를 저장 (데이터 분리 핵심)
  if (currentLayout === 'A') dataA = collectValues();
  else dataB = collectValues();

  // 2. 레이아웃 변경
  currentLayout = l;
  document.getElementById('tab-typeA').classList.toggle('active', l === 'A');
  document.getElementById('tab-typeB').classList.toggle('active', l === 'B');
  
  // 기술용역형(B)의 경우 기본 4행(핵심 항목들)을 위해 rowCount 보정
  if (l === 'B' && rowCount < 4) {
    rowCount = 4;
  }
  
  // 3. 변경된 레이아웃의 데이터로 렌더링 (저장된 데이터 전달)
  const targetData = (l === 'A' ? dataA : dataB) || { items: [] };
  render(targetData);
}

function addRow() {
  if (currentLayout === 'B') {
    const saved = collectValues();
    rowCount++;
    const tbody = document.getElementById('itemBody');
    if (tbody) {
      tbody.innerHTML = buildRowsB(saved);
      // 이벤트 재연결 및 계산/레이아웃 갱신
      attachEvents();
      calcAll();
      updateLogo(); // updateLogo -> paginatePages (P2/P3 등은 건드리지 않음)
    }
  } else {
    rowCount++;
    render();
  }
}
function delRow() {
  const minRows = (currentLayout === 'B' ? 4 : 1);
  if (rowCount <= minRows) return;
  
  if (currentLayout === 'B') {
    const saved = collectValues();
    rowCount--;
    const tbody = document.getElementById('itemBody');
    if (tbody) {
      tbody.innerHTML = buildRowsB(saved);
      attachEvents();
      calcAll();
      updateLogo();
    }
  } else {
    rowCount--;
    render();
  }
}

// ── 초기화
function resetForm() {
  if (!confirm('내용을 모두 초기화할까요? (일반/기술용역 데이터가 모두 사라집니다.)')) return;
  dataA = null;
  dataB = null;
  rowCount = 6;
  render({ items: [] });
}

// ═══════════════════════════════════════════════
//  PDF 다운로드
// ═══════════════════════════════════════════════
async function downloadPDF() {
  const btn = document.getElementById('btnPDF') || document.querySelector('.btn-pdf');
  if (!btn) { console.error('PDF 버튼을 찾을 수 없습니다.'); window.print(); return; }
  const originalText = btn.innerHTML;
  const dropdown = document.querySelector('.dropdown');
  
  try {
    _isExporting = true;
    if (dropdown) dropdown.classList.add('active'); // 메뉴 유지

    btn.disabled = true;
    btn.innerHTML = '<svg class="spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="margin-right:5px"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg> 번호 확정 중...';
    
    // 1. 서버에서 실제 번호를 확정받음
    const finalSeq = await incrementQuoteNo();
    
    // 2. 확정된 번호로 화면 갱신
    const y = new Date().getFullYear();
    const m = String(new Date().getMonth()+1).padStart(2,'0');
    _currentQuoteNo = `${y}-${m}-${String(finalSeq).padStart(4, '0')}`;
    render();
    
    // 3. 잠시 후 출력
    setTimeout(() => {
      // 인쇄 시 placeholder 제거 (빈 값이면 안내 문구가 출력되는 문제 해결)
      const inputs = document.querySelectorAll('input[placeholder], textarea[placeholder]');
      const originalPlaceholders = [];
      inputs.forEach(el => {
        originalPlaceholders.push({ el: el, text: el.getAttribute('placeholder') });
        el.setAttribute('placeholder', '');
      });

      window.print();
      
      // 인쇄 후 placeholder 복구
      originalPlaceholders.forEach(item => {
        item.el.setAttribute('placeholder', item.text);
      });
      
      _currentQuoteNo = null;
      render();

      btn.disabled = false;
      btn.innerHTML = originalText;
      _isExporting = false;
      if (dropdown) dropdown.classList.remove('active'); // 완료 후 닫기
    }, 500);
  } catch (e) {
    console.error("번호 갱신 실패:", e);
    alert("번호 확정 중 오류가 발생했습니다.");
    btn.disabled = false;
    btn.innerHTML = originalText;
    _isExporting = false;
    if (dropdown) dropdown.classList.remove('active');
  }
}
async function downloadExcel() {
  const co = companies[currentCompany];
  const saved = collectValues();
  const isB = currentLayout === 'B';
  const coName = currentCompany === 'baron' ? '바론컨설턴트' : '장헌기술단';
  const today = new Date().toISOString().slice(0,10);
  const workbook = new ExcelJS.Workbook();

  // 공통 스타일 정의
  const borderStyle = {
    top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}
  };
  const headerFill = {
    type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFF5F5F5'}
  };
  const centerAlign = { horizontal: 'center', vertical: 'middle' };
  const rightAlign = { horizontal: 'right', vertical: 'middle' };

  // ── 1. 메인 견적서 시트 ────────────────
  const sheet = workbook.addWorksheet(isB ? '견적요약' : '견적서');
  const colCount = isB ? 8 : 7;

  // 너비 설정
  if (isB) {
    sheet.columns = [
      { width: 5 }, { width: 28 }, { width: 15 }, { width: 6 }, { width: 6 }, { width: 15 }, { width: 15 }, { width: 15 }
    ];
  } else {
    sheet.columns = [
      { width: 5 }, { width: 35 }, { width: 8 }, { width: 10 }, { width: 15 }, { width: 15 }, { width: 15 }
    ];
  }

  // 제목 (Row 1)
  sheet.mergeCells(1, 1, 1, colCount);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = isB ? '견 적 요 약 서' : '견 적 서';
  titleCell.font = { size: 24, bold: true, letterSpacing: 10 };
  titleCell.alignment = centerAlign;

  // 견적번호 (Row 2)
  sheet.mergeCells(2, 1, 2, colCount);
  const noCell = sheet.getCell(2, 1);
  noCell.value = '견적번호: ' + (getQuoteNo().str);
  noCell.alignment = { horizontal: 'right' };
  noCell.font = { size: 10, color: {argb: 'FF666666'} };

  // 상단 정보 (Row 4~8)
  const infoData = [
    ['견적일', saved.quoteDate, '', '', '상호', co.corp],
    ['수신', saved.clientName + ' 귀하', '', '', '사업자번호', co.regNo],
    ['', '', '', '', '대표자', co.ceo],
    ['', '', '', '', '소재지', co.address],
    ['', '', '', '', '담당자', saved.contactPerson]
  ];

  infoData.forEach((row, i) => {
    const rIdx = 4 + i;
    sheet.getRow(rIdx).values = row;
    sheet.mergeCells(rIdx, 2, rIdx, 4);
    sheet.mergeCells(rIdx, 6, rIdx, colCount);
    
    // 라벨 스타일
    [1, 5].forEach(c => {
      const cell = sheet.getCell(rIdx, c);
      cell.fill = headerFill;
      cell.font = { bold: true };
      cell.alignment = centerAlign;
      cell.border = borderStyle;
    });
    // 값 스타일
    [2, 6].forEach(c => {
      const cell = sheet.getCell(rIdx, c);
      cell.border = borderStyle;
      cell.alignment = { vertical: 'middle', indent: 1 };
    });
  });

  // 사업명 (Row 10)
  sheet.getRow(10).values = ['사업명', saved.projectName];
  sheet.mergeCells(10, 2, 10, colCount);
  const projLbl = sheet.getCell(10, 1);
  projLbl.fill = headerFill; projLbl.font = { bold: true }; projLbl.alignment = centerAlign; projLbl.border = borderStyle;
  const projVal = sheet.getCell(10, 2);
  projVal.border = borderStyle; projVal.font = { bold: true }; projVal.alignment = { vertical: 'middle', indent: 1 };

  // 테이블 헤더 (Row 12)
  const header = isB
    ? ['No.','품목','규격','단위','수량','단가','공급가액','비고']
    : ['No.','품명','단위','수량','단가(원)','금액(원)','비고'];
  sheet.getRow(12).values = header;
  sheet.getRow(12).eachCell(c => {
    c.fill = { type:'pattern', pattern:'solid', fgColor:{argb: isB ? 'FFE0F2F1' : 'FFF5F5F5'} };
    c.font = { bold: true };
    c.alignment = centerAlign;
    c.border = borderStyle;
  });

  // 품목 데이터 (Row 13~)
  let curRow = 13;
  const startDataRow = curRow;
  saved.items.forEach((it, i) => {
    const r = sheet.getRow(curRow + i);
    if (isB) {
      r.values = [it.no, it.name, it.spec, it.unit, parseNum(it.qty), parseNum(it.price), parseNum(it.amount), it.note];
    } else {
      r.values = [it.no, it.name, it.unit, parseNum(it.qty), parseNum(it.price), parseNum(it.amount), it.note];
    }
    r.eachCell((c, colIdx) => {
      c.border = borderStyle;
      if (colIdx === 5 || colIdx === 6 || (isB && colIdx === 7)) {
        c.alignment = rightAlign;
        c.numFmt = '#,##0';
      } else {
        c.alignment = centerAlign;
      }
    });
  });
  curRow += saved.items.length;
  const endDataRow = curRow - 1;

  // 하단 요약 (소계, 절사, 부가세, 합계)
  const summaryRows = [
    ['소계', '', '', '', '', '', document.getElementById('subTotal')?.textContent.replace(/,/g,'')*1 || 0],
    ['절사금액', '', '', '', '', '', document.getElementById('discountVal')?.textContent.replace(/,/g,'')*1 || 0],
    ['부가가치세', '', '', '', '', '', document.getElementById('vatVal')?.textContent.replace(/,/g,'')*1 || 0],
    ['견적금액', '', '', '', '', '', document.getElementById('totalVal')?.textContent.replace(/,/g,'')*1 || 0]
  ];

  summaryRows.forEach((row, i) => {
    const rIdx = curRow + i;
    sheet.getRow(rIdx).values = row;
    sheet.mergeCells(rIdx, 1, rIdx, colCount - 2);
    const lbl = sheet.getCell(rIdx, 1);
    lbl.alignment = centerAlign; lbl.border = borderStyle; lbl.fill = headerFill;
    const val = sheet.getCell(rIdx, colCount - 1);
    val.alignment = rightAlign; val.border = borderStyle; val.numFmt = '#,##0';
    if (i === 3) val.font = { bold: true, color: {argb: 'FFD32F2F'} };
    sheet.getCell(rIdx, colCount).border = borderStyle; // 비고칸
  });
  curRow += 4;

  // 비고 (Memo)
  curRow++;
  sheet.mergeCells(curRow, 1, curRow, colCount);
  const memoLbl = sheet.getCell(curRow, 1);
  memoLbl.value = '비고'; memoLbl.fill = headerFill; memoLbl.font = { bold: true }; memoLbl.border = borderStyle;
  curRow++;
  sheet.mergeCells(curRow, 1, curRow + 2, colCount);
  const memoVal = sheet.getCell(curRow, 1);
  memoVal.value = saved.memo;
  memoVal.alignment = { vertical: 'top', wrapText: true };
  memoVal.border = borderStyle;
  curRow += 4;

  // 하단 고정 정보
  sheet.getRow(curRow).values = ['결제정보', saved.bankInfo, '', '', '지불조건', saved.payCondition];
  sheet.mergeCells(curRow, 2, curRow, 4);
  sheet.mergeCells(curRow, 6, curRow, colCount);
  sheet.getRow(curRow+1).values = ['견적유효기간', saved.validity];
  sheet.mergeCells(curRow+1, 2, curRow+1, colCount);
  
  [curRow, curRow+1].forEach(rIdx => {
    sheet.getCell(rIdx, 1).font = { bold: true };
    if (rIdx === curRow) sheet.getCell(rIdx, 5).font = { bold: true };
  });

  // ── 2. 기술용역형 상세 시트 ────────────────
  if (isB) {
    const sheetL = workbook.addWorksheet('인건비산출');
    sheetL.columns = [{width:20},{width:12},{width:15},{width:15},{width:18},{width:20}];
    sheetL.mergeCells(1,1,1,6);
    const tL = sheetL.getCell(1,1); tL.value = '직접인건비 산출근거'; tL.font = {size:16, bold:true}; tL.alignment = centerAlign;
    
    const lHeader = ['구분', '인원(명)', '참여기간(개월)', '단가', '실행금액(원)', '비고'];
    sheetL.getRow(3).values = lHeader;
    sheetL.getRow(3).eachCell(c => { c.fill = headerFill; c.font = {bold:true}; c.border = borderStyle; c.alignment = centerAlign; });

    saved.items.forEach((it, i) => {
      const r = sheetL.getRow(4+i);
      r.values = [it.name, parseNum(it.qty), parseNum(it.month), parseNum(it.price), parseNum(it.amount), it.note];
      r.eachCell((c, ci) => { 
        c.border = borderStyle; 
        if(ci >= 2 && ci <= 5) { c.alignment = rightAlign; c.numFmt = '#,##0'; }
        else { c.alignment = centerAlign; }
      });
    });

    // 경비 시트도 유사하게 스타일링... (생략하거나 핵심만 구현)
  }

  // 저장
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `견적서_${coName}_${today}.xlsx`;
  link.click();
}

// ═══════════════════════════════════════════════
//  견적번호 관리 (Google Sheets 공유)
// ═══════════════════════════════════════════════
async function fetchSharedQuoteNo() {
  const y = new Date().getFullYear();
  const m = String(new Date().getMonth()+1).padStart(2,'0');
  const key = `quoteSeq_${y}${m}`;
  
  try {
    const response = await fetch(`${GS_URL}?action=read`);
    const data = await response.json();
    _serverSeq = parseInt(data.seq || 0);
    // 성공 시 로컬에도 저장
    localStorage.setItem(key, _serverSeq);
    return _serverSeq;
  } catch (e) {
    console.error("서버 번호 로드 실패, 로컬 저장소 사용:", e);
    _serverSeq = parseInt(localStorage.getItem(key) || '0');
    return _serverSeq;
  }
}

function getQuoteNo() {
  const y = new Date().getFullYear();
  const m = String(new Date().getMonth()+1).padStart(2,'0');
  const seq = _serverSeq !== null ? _serverSeq : 0;
  
  // 표시할 번호는 (마지막 발행 번호 + 1)
  return { 
    seq, 
    str: `${y}-${m}-${String(seq + 1).padStart(4,'0')}` 
  };
}

async function incrementQuoteNo() {
  const y = new Date().getFullYear();
  const m = String(new Date().getMonth()+1).padStart(2,'0');
  const key = `quoteSeq_${y}${m}`;

  try {
    const projectName = document.getElementById('projectName')?.value || "";
    const clientName = document.getElementById('clientName')?.value || "";
    
    const params = new URLSearchParams({
      action: 'increment',
      title: projectName,
      client: clientName
    });

    const response = await fetch(`${GS_URL}?${params.toString()}`, { method: 'GET' });
    const data = await response.json();
    _serverSeq = parseInt(data.seq);
    
    // 성공 시 로컬 업데이트
    localStorage.setItem(key, _serverSeq);
    return _serverSeq;
  } catch (e) {
    console.error("서버 번호 증가 실패:", e);
    // 실패 시 로컬에서라도 증가 (최후의 수단)
    _serverSeq = (_serverSeq || parseInt(localStorage.getItem(key) || '0')) + 1;
    localStorage.setItem(key, _serverSeq);
    return _serverSeq;
  }
}

// 현재 세션의 임시 번호 (PDF 출력 전까지는 미확정)
let _currentQuoteNo = null;
function getDisplayNo() {
  if (!_currentQuoteNo) {
    const { str } = getQuoteNo();
    _currentQuoteNo = str;
  }
  return _currentQuoteNo;
}

// ── 기술용역형 인건비 산출 근거 자동 계산 ────────
function calcBasis() {
  const body = document.getElementById('basisBody');
  if (!body) return;
  
  const rows = body.querySelectorAll('tr:not(:last-child)');
  const sums = [0, 0, 0, 0];
  const count = rows.length;

  rows.forEach(tr => {
    const inputs = tr.querySelectorAll('.basis-val');
    for (let i = 0; i < 4; i++) {
      sums[i] += parseFloat(inputs[i].value.replace(/,/g, '')) || 0;
    }
  });

  const avgs = sums.map(s => Math.round(s / count));
  const avgCells = document.querySelectorAll('.basis-avg'); // document로 변경하여 tbody 밖의 셀도 감지
  const appliedInputs = document.querySelectorAll('.applied-val');

  for (let i = 0; i < 4; i++) {
    const valStr = fmt(avgs[i]);
    if (avgCells[i]) avgCells[i].textContent = valStr;
    if (appliedInputs[i]) appliedInputs[i].value = valStr;
  }

  // 적용 인건비가 바뀌었으므로 상단 상세 표와 동기화
  syncAppliedToTop();
}

function syncAppliedToTop() {
  const appliedInputs = document.querySelectorAll('.applied-val');
  const detailBody = document.getElementById('laborDetailBody');
  if (!detailBody) return;
  
  const detailRows = detailBody.querySelectorAll('tr:not(:last-child)');
  const rates = Array.from(appliedInputs).map(el => el.value);
  
  if (detailRows[0]) detailRows[0].querySelectorAll('input')[2].value = rates[3];
  if (detailRows[1]) detailRows[1].querySelectorAll('input')[2].value = rates[2];
  if (detailRows[2]) detailRows[2].querySelectorAll('input')[2].value = rates[1];
  if (detailRows[3]) detailRows[3].querySelectorAll('input')[2].value = rates[0];

  calcBreakdown();
}



// ═══════════════════════════════════════════════
//  초기 실행
// ═══════════════════════════════════════════════
render(); 

fetchSharedQuoteNo().then(() => {
  _currentQuoteNo = null; 
  const noStr = getDisplayNo();
  const noEl = document.getElementById('displayNo');
  if (noEl) noEl.textContent = noStr;
});

// ── 내보내기 메뉴 토글 ────────────────
let _isExporting = false; 

function toggleExportMenu(e) {
  if (_isExporting) return; 
  e.stopPropagation();
  const dropdown = document.querySelector('.dropdown');
  if (dropdown) dropdown.classList.toggle('active');
}

window.addEventListener('click', () => {
  if (_isExporting) return; 
  const dropdown = document.querySelector('.dropdown');
  if (dropdown) dropdown.classList.remove('active');
});
