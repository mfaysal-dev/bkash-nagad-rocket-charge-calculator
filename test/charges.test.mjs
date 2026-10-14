import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charge, maxFromBalance, compareAll, rateFor } from '../public/charges.js';

test('bKash Priyo Agent: Tk 13.95 per 1,000', () => {
  assert.equal(charge('bkash', 'priyo', 1000).fee, 13.95);
  assert.equal(charge('bkash', 'priyo', 5000).fee, 69.75);
});

test('bKash official example: 49,500 used + 600 more = over the limit, Tk 18.50 per 1,000', () => {
  const c = charge('bkash', 'priyo', 600, { usedThisMonth: 49500 });
  assert.equal(c.overLimit, true);
  assert.equal(c.fee, 11.1);
});

test('bKash: exactly reaching Tk 50,000 still gets the Priyo rate', () => {
  assert.equal(charge('bkash', 'priyo', 500, { usedThisMonth: 49500 }).perThousand, 13.95);
});

test('bKash other agent Tk 18.50 and ATM Tk 14.90 per 1,000', () => {
  assert.equal(charge('bkash', 'agent', 1000).fee, 18.5);
  assert.equal(charge('bkash', 'atm', 10000).fee, 149);
});

test('Nagad app Tk 12.99, USSD Tk 15 per 1,000', () => {
  assert.equal(charge('nagad', 'app', 1000).fee, 12.99);
  assert.equal(charge('nagad', 'ussd', 2000).fee, 30);
});

test('Rocket general: agent 1.67%, DBBL ATM 0.9%', () => {
  assert.equal(charge('rocket', 'agent', 1000).fee, 16.7);
  assert.equal(charge('rocket', 'atm', 1000).fee, 9);
});

test('Rocket salary account: agent 0.9%, ATM free, branch Tk 10 flat', () => {
  assert.equal(charge('rocket', 'agent', 1000, { salaryAccount: true }).fee, 9);
  assert.equal(charge('rocket', 'atm', 5000, { salaryAccount: true }).fee, 0);
  assert.equal(charge('rocket', 'branch', 5000, { salaryAccount: true }).fee, 10);
});

test('Total deducted = amount + charge', () => {
  assert.equal(charge('bkash', 'agent', 2500).total, 2546.25);
});

test('Max cash out from a balance', () => {
  const a = maxFromBalance('bkash', 'agent', 10000);
  assert.equal(a, 9818); // 9,818 + 181.63 = 9,999.63
  assert.ok(charge('bkash', 'agent', a + 1).total > 10000);
  assert.equal(maxFromBalance('rocket', 'atm', 5000, { salaryAccount: true }), 5000);
});

test('Comparison is sorted cheapest first', () => {
  const list = compareAll(1000);
  assert.equal(list[0].fee <= list[list.length - 1].fee, true);
  assert.equal(list.length, 9);
});

test('Unknown method returns null', () => {
  assert.equal(rateFor('bkash', 'nope'), null);
});
