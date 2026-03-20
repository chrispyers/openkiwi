---
name: calculate-taxes
description: Calculate income taxes, deductions, and net pay for individuals or businesses. Use when the user needs to estimate or compute taxes based on income, filing status, or jurisdiction.
license: Apache-2.0
allowed-tools: bash
metadata:
  author: openkiwi
  version: "1.0"
---

# Calculate Taxes Skill

## When to use this skill
Use this skill when the user asks to calculate, estimate, or review taxes based on income data, deductions, or filing status.

## How to calculate taxes

1. Gather the required inputs from the user:
   - Gross income
   - Filing status (single, married filing jointly, married filing separately, head of household)
   - Applicable deductions (standard or itemized)
   - Jurisdiction (e.g., US federal, state)

2. **You MUST run the bundled Python script to compute the result. Do not calculate taxes yourself — always use the script.**
   - The `activate_skill` response includes a `scripts_path` field containing the absolute path to the scripts directory.
   - Call the `bash` tool with the command: `python3 {scripts_path}/calculate_taxes.py {gross_income} {filing_status}`
   - Do not set the `cwd` parameter — it is not needed when using an absolute script path.
   - If the script returns an error, report the exact error to the user. Do not fall back to manual calculation.

3. Return the results clearly, including:
   - Taxable income
   - Estimated tax owed
   - Effective tax rate
   - Net income after tax

## Example

**Input:**
- Gross income: $80,000
- Filing status: single
- Standard deduction: $14,600 (2024 US federal)

**Output:**
- Taxable income: $65,400
- Estimated federal tax: ~$10,294
- Effective rate: ~12.9%
- Net income: ~$69,706

## Common edge cases
- If the user doesn't specify filing status, ask for clarification before proceeding.
- Self-employment income requires additional SE tax calculation (15.3% on net SE income).
- State taxes vary significantly — confirm jurisdiction before computing.
