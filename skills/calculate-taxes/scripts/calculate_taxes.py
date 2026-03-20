#!/usr/bin/env python3
"""
Simple US federal income tax calculator (2024 tax year).
Usage: python3 calculate_taxes.py <gross_income> <filing_status>
  filing_status: single | married_jointly | married_separately | head_of_household
"""

import sys
import json

# 2024 standard deductions
STANDARD_DEDUCTIONS = {
    "single": 14600,
    "married_jointly": 29200,
    "married_separately": 14600,
    "head_of_household": 21900,
}

# 2024 US federal tax brackets (single filer)
BRACKETS = {
    "single": [
        (11600, 0.10),
        (47150, 0.12),
        (100525, 0.22),
        (191950, 0.24),
        (243725, 0.32),
        (609350, 0.35),
        (float("inf"), 0.37),
    ],
    "married_jointly": [
        (23200, 0.10),
        (94300, 0.12),
        (201050, 0.22),
        (383900, 0.24),
        (487450, 0.32),
        (731200, 0.35),
        (float("inf"), 0.37),
    ],
    "married_separately": [
        (11600, 0.10),
        (47150, 0.12),
        (100525, 0.22),
        (191950, 0.24),
        (243725, 0.32),
        (365600, 0.35),
        (float("inf"), 0.37),
    ],
    "head_of_household": [
        (16550, 0.10),
        (63100, 0.12),
        (100500, 0.22),
        (191950, 0.24),
        (243700, 0.32),
        (609350, 0.35),
        (float("inf"), 0.37),
    ],
}


def calculate_tax(gross_income: float, filing_status: str) -> dict:
    if filing_status not in BRACKETS:
        return {"error": f"Unknown filing status: {filing_status}. Use: {list(BRACKETS.keys())}"}

    standard_deduction = STANDARD_DEDUCTIONS[filing_status]
    taxable_income = max(0, gross_income - standard_deduction)

    brackets = BRACKETS[filing_status]
    tax = 0.0
    prev_limit = 0.0

    for limit, rate in brackets:
        if taxable_income <= prev_limit:
            break
        taxable_in_bracket = min(taxable_income, limit) - prev_limit
        tax += taxable_in_bracket * rate
        prev_limit = limit

    effective_rate = (tax / gross_income * 100) if gross_income > 0 else 0
    net_income = gross_income - tax

    return {
        "gross_income": round(gross_income, 2),
        "filing_status": filing_status,
        "standard_deduction": standard_deduction,
        "taxable_income": round(taxable_income, 2),
        "estimated_federal_tax": round(tax, 2),
        "effective_tax_rate_pct": round(effective_rate, 2),
        "net_income_after_tax": round(net_income, 2),
    }


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: calculate_taxes.py <gross_income> <filing_status>"}))
        sys.exit(1)

    try:
        gross = float(sys.argv[1])
        status = sys.argv[2].lower().replace(" ", "_")
        result = calculate_tax(gross, status)
        print(json.dumps(result, indent=2))
    except ValueError:
        print(json.dumps({"error": "gross_income must be a number"}))
        sys.exit(1)
