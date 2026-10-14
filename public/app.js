import { RATES, charge, maxFromBalance, compareAll } from './charges.js';
import { $, $$, bindActions, setParams, initLang, getLang, t, tk, nf, parseNum } from './ui.js';

const rates = structuredClone(RATES);
const DEFAULT_METHOD = { bkash: 'priyo', nagad: 'app', rocket: 'atm' };
const state = { mode: 'amount', amount: 5000, prov: 'bkash', method: 'priyo', used: 0, salary: false };
const el = { amount: $('#amount'), used: $('#used'), salary: $('#salary'), methods: $('#methods'), editor: $('#editor') };
let last = null;
const pname = (p) => t(rates[p].nameBn, rates[p].name);
const mlabel = (p, m) => t(rates[p].methods[m].labelBn, rates[p].methods[m].label);

function readParams() {
  const q = new URLSearchParams(location.search);
  if (q.get('mode') === 'balance') state.mode = 'balance';
  if (q.has('a')) state.amount = parseNum(q.get('a'), 1e7);
  if (rates[q.get('p')]) state.prov = q.get('p');
  state.method = rates[state.prov].methods[q.get('m')] ? q.get('m') : DEFAULT_METHOD[state.prov];
  if (q.has('used')) state.used = parseNum(q.get('used'), 1e7);
  state.salary = q.get('sal') === '1';
  for (const pair of (q.get('r') || '').split(',')) {
    const [key, v] = pair.split(':'); const [p, m] = (key || '').split('.');
    if (rates[p]?.methods[m] && v != null) rates[p].methods[m].perThousand = Math.min(1000, parseNum(v));
  }
}
function changedRates() {
  const out = [];
  for (const p of Object.keys(rates)) for (const m of Object.keys(rates[p].methods)) if (rates[p].methods[m].perThousand !== RATES[p].methods[m].perThousand) out.push(`${p}.${m}:${rates[p].methods[m].perThousand}`);
  return out.join(',');
}
function writeParams() {
  setParams({ mode: state.mode === 'balance' && 'balance', a: state.amount, p: state.prov !== 'bkash' && state.prov, m: state.method !== DEFAULT_METHOD[state.prov] && state.method,
    used: state.prov === 'bkash' && state.method === 'priyo' && state.used ? state.used : '', sal: state.prov === 'rocket' && state.salary, r: changedRates(), lang: getLang() === 'en' && 'en' });
}
function rateText(p, m) {
  const x = rates[p].methods[m];
  if (p === 'rocket' && state.salary) return x.salaryFlat != null ? t(`প্রতি লেনদেনে ${tk(x.salaryFlat)}`, `${tk(x.salaryFlat)} per transaction`) : x.salary === 0 ? t('ফ্রি', 'Free') : t(`হাজারে ${tk(x.salary, 2)}`, `${tk(x.salary, 2)} per 1,000`);
  return t(`হাজারে ${tk(x.perThousand, 2)}`, `${tk(x.perThousand, 2)} per 1,000`);
}
function renderMethods() {
  el.methods.innerHTML = Object.keys(rates[state.prov].methods).map((m) => `<label class="opt"><input type="radio" name="method" value="${m}"${m === state.method ? ' checked' : ''}><span class="dot"></span><span><strong>${mlabel(state.prov, m)}</strong><small>${rateText(state.prov, m)}</small></span></label>`).join('');
  $('#usedWrap').hidden = !(state.prov === 'bkash' && state.method === 'priyo');
  $('#salaryWrap').hidden = state.prov !== 'rocket';
}
function renderEditor() {
  el.editor.innerHTML = Object.keys(rates).map((p) => `<div class="edit"><h4>${pname(p)} ${rates[p].verified ? '' : `<span class="flag">${t('অযাচাইকৃত', 'Unverified')}</span>`}</h4>`
    + Object.keys(rates[p].methods).map((m) => `<label for="e-${p}-${m}">${mlabel(p, m)}</label><input id="e-${p}-${m}" type="number" inputmode="decimal" min="0" max="1000" step="0.01" value="${rates[p].methods[m].perThousand}" data-p="${p}" data-m="${m}">`).join('') + '</div>').join('');
}
function syncInputs() {
  el.amount.value = state.amount.toLocaleString('en-IN'); el.used.value = state.used.toLocaleString('en-IN'); el.salary.checked = state.salary;
  $(`input[name=mode][value="${state.mode}"]`).checked = true; $(`input[name=prov][value="${state.prov}"]`).checked = true;
  renderMethods();
}
function opts() { return { usedThisMonth: state.used, salaryAccount: state.salary, rates }; }

function update() {
  const o = opts();
  const amount = state.mode === 'balance' ? maxFromBalance(state.prov, state.method, state.amount, o) : state.amount;
  const c = charge(state.prov, state.method, amount, o);
  const all = compareAll(amount, o);
  last = { c, amount, all };
  $('#amountL').textContent = state.mode === 'balance' ? t('আপনার ব্যালেন্স', 'Your balance') : t('ক্যাশ আউটের পরিমাণ', 'Amount to cash out');
  $('#bigLabel').textContent = state.mode === 'balance' ? t('সর্বোচ্চ তুলতে পারবেন', 'Most you can cash out') : t('ক্যাশ আউট চার্জ', 'Cash out charge');
  $('#total').textContent = state.mode === 'balance' ? tk(amount) : tk(c.fee, 2);
  $('#summary').textContent = state.mode === 'balance'
    ? t(`${tk(state.amount, 2)} ব্যালেন্স থেকে ${pname(state.prov)} (${mlabel(state.prov, state.method)})-এ চার্জ ${tk(c.fee, 2)}`, `From a ${tk(state.amount, 2)} balance with ${pname(state.prov)} (${mlabel(state.prov, state.method)}), charge ${tk(c.fee, 2)}`)
    : t(`${pname(state.prov)} · ${mlabel(state.prov, state.method)} · ${tk(amount)} তুলতে`, `${pname(state.prov)} · ${mlabel(state.prov, state.method)} · to cash out ${tk(amount)}`);
  $('#sGet').textContent = tk(amount); $('#sTotal').textContent = tk(c.total, 2);
  $('#sRate').textContent = c.flat != null ? t(`${tk(c.flat)}/লেনদেন`, `${tk(c.flat)}/txn`) : tk(c.perThousand, 2);
  const best = all[0];
  $('#sBest').textContent = best ? `${t(best.nameBn, best.name)} · ${tk(best.fee, 2)}` : '–';

  const notes = [];
  if (c.overLimit) notes.push(['warn', t(`⚠️ এই লেনদেনে মাসের প্রিয় এজেন্ট সীমা (৫০,০০০ টাকা) ছাড়িয়ে যাচ্ছে, তাই পুরো ${tk(amount)}-এ ১৮.৫০ টাকা/হাজার চার্জ কাটবে।`, `⚠️ This takes your Priyo total over the Tk 50,000 monthly limit, so the whole ${tk(amount)} is charged at Tk 18.50 per 1,000.`)]);
  if (state.prov === 'bkash' && state.method === 'priyo' && !c.overLimit && state.used + amount > 0) notes.push(['', t(`এই মাসে প্রিয় এজেন্টে আরও ${tk(Math.max(0, 50000 - state.used - amount))} পর্যন্ত কম চার্জে তুলতে পারবেন।`, `You can cash out ${tk(Math.max(0, 50000 - state.used - amount))} more at the Priyo rate this month.`)]);
  if (!rates[state.prov].verified) notes.push(['warn', t('⚠️ নগদের চার্জ অফিসিয়াল সাইটে যাচাই করা যায়নি। অ্যাপে চার্জ মিলিয়ে নিন, ভিন্ন হলে নিচের “চার্জ বদলান” অংশে লিখুন।', '⚠️ Nagad’s charges couldn’t be verified on its official site. Check the charge in the app and edit it under “Edit the rates” if it’s different.')]);
  if (best && best.fee + 0.005 < c.fee) notes.push(['', t(`${t(best.nameBn, best.name)} (${t(best.labelBn, best.label)})-এ একই টাকা তুলতে চার্জ ${tk(best.fee, 2)}, অর্থাৎ ${tk(c.fee - best.fee, 2)} কম।`, `${best.name} (${best.label}) would cost ${tk(best.fee, 2)} for the same amount, ${tk(c.fee - best.fee, 2)} less.`)]);
  if (changedRates()) notes.push(['', t('আপনার নিজের লেখা চার্জ ব্যবহার করা হচ্ছে।', 'Using your edited rates.')]);
  $('#notes').innerHTML = notes.map(([k, x]) => `<div class="note ${k}">${x}</div>`).join('');

  $('#cmp').innerHTML = all.map((x, i) => {
    const per = x.flat != null ? t(`${tk(x.flat)}/লেনদেন`, `${tk(x.flat)}/txn`) : tk(x.perThousand, 2);
    const cls = [x.provider === state.prov && x.method === state.method ? 'cur' : '', i === 0 ? 'best' : ''].filter(Boolean).join(' ');
    return `<tr${cls ? ` class="${cls}"` : ''}><td>${t(x.nameBn, x.name)} · ${t(x.labelBn, x.label)}</td><td class="r">${per}</td><td class="r">${tk(x.fee, 2)}</td><td class="r">${tk(x.total, 2)}</td><td>${x.verified ? `<span class="ok">${t('অফিসিয়াল', 'Official')}</span>` : `<span class="flag">${t('অযাচাইকৃত', 'Unverified')}</span>`}</td></tr>`;
  }).join('');
  writeParams();
}
function resultText() {
  const { c, amount } = last;
  return [t('ক্যাশ আউট চার্জ হিসাব', 'Cash out charge'), `${pname(state.prov)} · ${mlabel(state.prov, state.method)}`,
    t(`পরিমাণ: ${tk(amount)}`, `Amount: ${tk(amount)}`), t(`চার্জ: ${tk(c.fee, 2)}`, `Charge: ${tk(c.fee, 2)}`), t(`মোট কাটবে: ${tk(c.total, 2)}`, `Total deducted: ${tk(c.total, 2)}`), location.href].join('\n');
}

el.amount.addEventListener('input', () => { state.amount = parseNum(el.amount.value, 1e7); update(); });
el.amount.addEventListener('blur', () => { el.amount.value = state.amount.toLocaleString('en-IN'); });
el.used.addEventListener('input', () => { state.used = parseNum(el.used.value, 1e7); update(); });
el.salary.addEventListener('change', () => { state.salary = el.salary.checked; renderMethods(); update(); });
$$('input[name=mode]').forEach((i) => i.addEventListener('change', () => { state.mode = i.value; update(); }));
$$('input[name=prov]').forEach((i) => i.addEventListener('change', () => { state.prov = i.value; state.method = DEFAULT_METHOD[state.prov]; renderMethods(); update(); }));
el.methods.addEventListener('change', (e) => { if (e.target.name === 'method') { state.method = e.target.value; renderMethods(); update(); } });
el.editor.addEventListener('input', (e) => { const { p, m } = e.target.dataset; if (!p) return; rates[p].methods[m].perThousand = Math.min(1000, parseNum(e.target.value)); renderMethods(); update(); });
$$('[data-a]').forEach((b) => b.addEventListener('click', () => { state.amount = +b.dataset.a; el.amount.value = state.amount.toLocaleString('en-IN'); update(); }));
bindActions({ result: resultText, shareMsg: () => t('লিংক কপি হয়েছে', 'Link copied'), copyMsg: () => t('ফলাফল কপি হয়েছে', 'Result copied') });

readParams(); syncInputs();
initLang(() => { renderMethods(); renderEditor(); update(); });
