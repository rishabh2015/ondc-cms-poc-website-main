---
title: RFPs/RFQs · ONDC Network
description: ONDC runs open tenders for the work of building the network —
  technology, research, communications and more. Review what's open, read the
  documents, and submit a proposal before the deadline.
permalink: /rfp.html
wrapper_tag: main
wrapper_class: bk bk-role-page bk-rfp-page
wrapper_id: ''
show_progress: true
styles:
  - fx
  - scale
  - type-boost
  - beckn
  - mobile
scripts:
  - /js/ondc/fx.js
  - /js/ondc/beckn.js
  - /js/ondc/scroll-progress.js
  - /js/ondc/rfp-ledger.js
sections:
  - _template: role_hero
    screen_label: Hero
    anchor_id: ''
    heading_id: rfp-hero-title
    heading: Unlock business
    heading_accent: opportunities
    heading_suffix: .
    copy: ONDC runs open tenders for the work of building the network — technology,
      research, communications and more. Review what's open, read the documents,
      and submit a proposal before the deadline.
    buttons:
      - label: View open RFPs
        url: '#rfp-ledger'
        style: solid
        new_tab: false
      - label: Sign up
        url: https://portal.ondc.org/
        style: ghost
        new_tab: true
    tally:
      show: true
      value_id: rfpTallyValue
      aria_label: Open RFP count
      placeholder: —
      label: RFPs and RFQs currently accepting proposals.
      source_note: Refreshed from the live tender feed
  - _template: rfp_ledger
    screen_label: The ledger
    anchor_id: rfp-ledger
    heading_id: rfp-ledger-title
    eyebrow: The ledger
    heading: Every opportunity,
    heading_accent: on the record
    heading_suffix: .
    tally_id: rfpTallyValue
    auto_by_date: true
    show_search: true
    search_placeholder: Search by RFP name or number
    search_label: Search RFPs and RFQs
    tabs_label: RFP categories
    due_label: Last date to apply
    timezone_label: IST
    tabs:
      - tab_key: open
        tab_label: Open
        tab_source: open
        tab_empty_heading: No records found
        tab_empty_body: Nothing matches this filter right now.
      - tab_key: closed
        tab_label: Closed
        tab_source: closed
        tab_empty_heading: No records found
        tab_empty_body: Nothing matches this filter right now.
      - tab_key: empanelled
        tab_label: Empanelled agencies
        tab_source: empanelled
        tab_empty_heading: No empanelled agencies yet
        tab_empty_body: This list is empty for now. Check back after the next
          empanelment cycle.
    tenders:
      - rfp_tab: open
        rfp_no: ONDC/RFP/2026/001
        rfp_name: Selection of an agency for brand and creative services
        rfp_deadline: 30.11.2026 17:30
        rfp_documents:
          - doc_type: RFP document
            doc_url: https://ondc-static-website-media.s3.ap-south-1.amazonaws.com/ondc-website-media/downloads/rfp/Annexure+-+D+(Health+Check+up+Tests+list).pdf
          - doc_type: Corrigendum 1
            doc_url: https://ondc-static-website-media.s3.ap-south-1.amazonaws.com/ondc-website-media/downloads/rfp/sample-rfp-2026-001-corrigendum-1.pdf
          - doc_type: demo
            doc_url: /files/rfp/commands.txt
      - rfp_tab: open
        rfp_no: ONDC/RFQ/2026/014
        rfp_name: Supply and support of network monitoring tooling
        rfp_deadline: ''
        rfp_documents:
          - doc_type: RFQ document
            doc_url: /files/rfp/sample-rfq-2026-014.pdf
          - doc_type: RFP document
            doc_url: ''
      - rfp_tab: closed
        rfp_no: ONDC/RFP/2026/009
        rfp_name: Research partner for seller adoption study
        rfp_deadline: ''
        rfp_documents:
          - doc_type: RFP document
            doc_url: /files/rfp/sample-rfp-2026-009.pdf
      - rfp_tab: empanelled
        rfp_no: ONDC/EMP/2026/002
        rfp_name: Example Communications Pvt Ltd
        rfp_deadline: ''
        rfp_documents:
          - doc_type: Empanelment letter
            doc_url: /files/rfp/sample-rfp-2026-009.pdf
      - rfp_no: ''
        name: ''
        last_date: ''
        documents:
          - doc_type: RFP document
            file: ''
            url: ''
      - rfp_tab: open
        rfp_no: ONDC/RFP/2026/010
        rfp_name: Just for test
        rfp_deadline: 14.10.2026 13:00
        rfp_documents:
          - doc_type: RFP demo document
            doc_url: https://ondc-static-website-media.s3.ap-south-1.amazonaws.com/ondc-website-media/downloads/rfp/Pri-bid+query+response_RFP+for+WMS+DigiDukaan+Project.docx.pdf
  - _template: closing_cta
    screen_label: Participant portal
    variant: role
    anchor_id: ''
    heading_id: rfp-close-title
    heading: ONDC Participant
    heading_accent: Portal
    heading_suffix: .
    body: Begin and efficiently manage your journey on the ONDC Network.
    buttons:
      - label: Sign up
        url: https://portal.ondc.org/
        style: solid
        new_tab: true
---
