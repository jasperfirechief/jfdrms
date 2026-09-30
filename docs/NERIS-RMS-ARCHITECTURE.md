# JFD RMS NERIS architecture

The incident workflow is type-aware: the primary NERIS incident type controls which report modules are shown, while the completed RMS report remains the department system of record. NERIS validation is performed before submission. Departmental incident PDFs contain a public-facing general page, applicable report sections (such as fire and PCR), and subsequent internal detail pages.

Daily shift report delivery runs at 0800 America/Chicago and packages each prior-shift incident as its own PDF attachment, plus staffing and apparatus-check records.