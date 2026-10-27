---
title: Ecosystem Participants · ONDC Network
description: Technology service providers build and run the software that buyer
  and seller apps sit on. Find the one that fits your role and category, and
  reach their team directly.
permalink: /ecosystem-participants.html
wrapper_tag: main
wrapper_class: bk bk-role-page bk-np-page
wrapper_id: ''
show_progress: true
show_sector_rail: true
styles:
  - fx
  - scale
  - type-boost
  - beckn
  - np-directory
  - mobile
scripts:
  - /js/ondc/fx.js
  - /js/ondc/beckn.js
  - /js/ondc/logo-fallback.js
  - /js/ondc/scroll-progress.js
  - /js/ondc/network-participants.js
sections:
  - _template: role_hero
    screen_label: Hero
    anchor_id: ''
    heading_id: eco-hero-title
    heading: The organisations that make the
    heading_accent: network work
    heading_suffix: ''
    copy: Technology service providers build and run the software that buyer and
      seller apps sit on. Find the one that fits your role and category below.
    buttons:
      - label: Join the Network
        url: https://portal.ondc.org/
        style: solid
        new_tab: true
      - label: Browse participants
        url: '#participant-roles'
        style: ghost
        new_tab: false
    tally:
      show: false
      value_id: ''
      aria_label: ''
      placeholder: '—'
      label: ''
      source_note: ''
  - _template: participant_directory
    screen_label: Ecosystem participant directory
    anchor_id: participant-roles
    directory_tabs:
      - label: Network Participants
        url: /network-participants.html
        current: false
      - label: Ecosystem Participants
        url: /ecosystem-participants.html
        current: true
    lists:
      - label: Ecosystem Participants
        source: ecosystem
        sort: alphabetical
        note: ''
    search_placeholder: Search by name, category, contact or website
    per_page: '20'
    per_page_choices: 20, 30, 50, 100
    show_export: true
    export_label: Export CSV
    disclaimer: 'Disclaimer: The list provided here is for information purposes
      only. ONDC does not make any representations or warranties regarding the
      accuracy or completeness of the information. ONDC does not endorse any of
      the entities listed here. ONDC does not offer any terms or make any
      representations or warranties regarding the participants or services
      provided by them.'
    labels:
      aria: Ecosystem participant directory
      tabs_aria: Participant directories
      filters: Filter by category
      category_heading: Category
      search: Search participants
      list_switch: Participant list
      roles: Filter by role
      active_filters: Active filters
      remove_filter: remove this filter
      clear_all: Clear all
      col_participant: Participant
      col_role: Role
      col_categories: Categories
      col_contact: Contact
      enabled_by: Live NPs supported
      not_recorded: Not recorded
      fewer: Fewer
      email: Email
      call: Call
      website: Website
      website_sr: for
      empty: No participants match these filters. Remove one above to widen the search.
      rows_per_page: Rows per page
      prev: Previous page
      next: Next page
      item_noun: participant
      item_noun_plural: participants
      export_filename: ondc-ecosystem-participants
  - _template: closing_cta
    screen_label: Participant Portal
    variant: role
    anchor_id: ''
    heading_id: eco-close-title
    heading: ONDC Participant
    heading_accent: Portal
    heading_suffix: ''
    body: Begin and efficiently manage your journey on ONDC Network.
    buttons:
      - label: Go to Participant Portal
        url: https://portal.ondc.org/
        style: solid
        new_tab: true
---
