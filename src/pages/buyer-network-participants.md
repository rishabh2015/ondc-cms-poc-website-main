---
title: Buyer Network Participant · ONDC Network
description: Connects buyers to the ONDC network via a buyer application and
  shoulders buyer-facing responsibilities such as customer support, ensuring a
  seamless shopping experience, and providing a single checkout experience
  across categories.
permalink: /buyer-network-participants.html
wrapper_tag: main
wrapper_class: bk bk-role-page
wrapper_id: ''
show_progress: true
show_sector_rail: true
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
sections:
  - _template: role_hero
    screen_label: Hero
    anchor_id: ''
    heading_id: buyer-hero-title
    heading: Connect every buyer to
    heading_accent: one open network.
    heading_suffix: ''
    copy: Connects buyers to the ONDC network via a buyer application and shoulders
      buyer-facing responsibilities such as customer support, ensuring a
      seamless shopping experience, and providing a single checkout experience
      across categories.
    buttons:
      - label: See buyer requirements
        url: '#buyer-role'
        style: solid
        new_tab: false
      - label: Join as a Buyer NP
        url: https://portal.ondc.org/
        style: ghost
        new_tab: true
    tally:
      show: true
      value_id: ''
      aria_label: Live buyer participant count
      animate: true
      count_role: ''
      placeholder: '—'
      label: Unique buyer-side organisations currently represented in the live registry.
      source_note: Loading registry
  - _template: numbered_lists
    variant: role
    screen_label: What a buyer application must do
    anchor_id: buyer-role
    heading_id: buyer-role-title
    eyebrow: ''
    heading: What a buyer application
    heading_accent: must make possible.
    lead: ''
    aria_label: Buyer application feature requirements
    paragraphs:
      - text: Any business with a strong customer base can join ONDC as a buyer network
          participant. This can be through your existing application, a
          white-labelled app, voice assistant, chatbot, or any interface which
          can integrate with the network, and fulfil the feature requirements
          mentioned below.
      - text: Buyer network participants can also choose to partner with a technology
          provider to create a buyer-facing interface integrated with ONDC.
    lead_link:
      label: Find out if ONDC is active in your domain industry
      url: /network-participants.html
      new_tab: false
    groups:
      - heading: ''
        intro: ''
        items:
          - point_title: Parse and match search requests
            text: Parse buyer search requests into relevant fields and search the network
              for qualifying products that fully or partially meet the request.
              Structured parsing · network-wide matching · full and partial
              matches.
          - point_title: Rank search results
            text: Display search results following identifying criteria such as closest
              store or product category. Relevant ranking · closest-store and
              category filters · consistent presentation.
          - point_title: Aggregate catalogue data
            text: Display network data such as ratings and catalogue information,
              including features, FAQs and specifications. Ratings and reviews ·
              full catalogue details · network-level data.
          - point_title: Support a multi-seller cart
            text: Allow a buyer to add items from multiple sellers or seller applications
              to one cart. Multiple sellers · one session · simpler multi-brand
              shopping.
          - point_title: Present delivery options
            text: Allow the buyer to select a delivery option when more than one exists
              for the chosen seller or seller application. Multiple choices ·
              checkout selection · per-seller logic.
          - point_title: Complete checkout and payment
            text: Enable checkout and payment to initiate a purchase. One unified checkout
              · payment initiation · a consistent experience across categories.
          - point_title: Confirm the order
            text: Confirm the order with the seller application or seller and send the
              buyer a confirmation with the order ID. Seller confirmation ·
              buyer notification · trackable order ID.
  - _template: closing_cta
    variant: role
    screen_label: Closing
    anchor_id: ''
    heading_id: buyer-close-title
    heading: Take your digital commerce
    heading_accent: to the next level.
    heading_suffix: ''
    body: Build a buyer-facing experience that can discover and transact across the
      open network.
    buttons:
      - label: Join as a Buyer NP
        url: https://portal.ondc.org/
        style: solid
        new_tab: true
---
