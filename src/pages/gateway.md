---
title: Gateway · ONDC Network
description: Gateways are essential components in an open-network ecosystem,
  serving as technology providers to ensure that all sellers in the ONDC
  Network can be discovered.
permalink: /gateway.html
wrapper_tag: main
wrapper_class: bk bk-role-page bk-gateway-page
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
    heading_id: gateway-title
    heading: Discovery needs
    heading_accent: every seller
    heading_suffix: ' to be reachable.'
    copy: Gateways are essential components in an open-network ecosystem, serving as
      technology providers to ensure that all sellers in the ONDC Network can
      be discovered.
    buttons:
      - label: Become a Gateway
        url: https://portal.ondc.org/
        style: solid
        new_tab: true
      - label: See how discovery works
        url: '#gateway-relay'
        style: ghost
        new_tab: false
    mark:
      show: true
      word: DISCOVER
      caption: The connective role between buyer search and the seller universe.
    tally:
      show: false
      value_id: ''
      aria_label: ''
      animate: false
      count_role: ''
      placeholder: '—'
      label: ''
      source_note: ''
  - _template: tagline_strip
    variant: bk
    screen_label: What a Gateway does
    anchor_id: ''
    heading_id: gateway-context-title
    title: One request,
    heading_accent: made discoverable
    heading_suffix: ' across the network.'
    subtitle: Gateways facilitate multicasting by forwarding search requests from buyer
      applications to all seller applications and vice versa, as specified in
      the ONDC Network Policies.
  - _template: numbered_lists
    variant: relay
    screen_label: The discovery relay
    anchor_id: gateway-relay
    heading_id: gateway-relay-title
    list_style: ''
    eyebrow: ''
    heading: The discovery
    heading_accent: relay
    heading_suffix: .
    lead: ''
    aria_label: ''
    paragraphs:
      - text: The Gateway service enables manual searches by end consumers by providing
          relevant product and service information from ONDC's seller universe.
    lead_link:
      label: ''
      url: ''
      new_tab: false
    groups:
      - heading: ''
        intro: ''
        items:
          - point_title: A buyer application asks.
            code: SEARCH
            text: A search request enters the open network.
          - point_title: The Gateway forwards it.
            code: MULTICAST
            text: The request is forwarded to seller applications, so discovery is not
              limited to a single destination.
          - point_title: Seller information returns.
            code: DISCOVER
            text: Relevant product and service information from the seller universe can
              be surfaced to the end consumer.
  - _template: numbered_lists
    variant: outcomes
    screen_label: What a Gateway gives the network
    anchor_id: ''
    heading_id: gateway-outcomes-title
    list_style: ''
    eyebrow: ''
    heading: A clearer route to
    heading_accent: discoverability
    heading_suffix: .
    lead: ''
    aria_label: ''
    paragraphs: []
    lead_link:
      label: ''
      url: ''
      new_tab: false
    groups:
      - heading: ''
        intro: ''
        items:
          - point_title: Connect seamlessly
            code: ''
            text: Support discovery across an open-network ecosystem.
          - point_title: Increase reach and visibility
            code: ''
            text: Help sellers become discoverable beyond a single application.
          - point_title: Surface relevant information
            code: ''
            text: Enable searches that draw from ONDC's seller universe.
  - _template: closing_cta
    variant: role
    screen_label: Closing
    anchor_id: ''
    heading_id: gateway-close-title
    heading: Become a
    heading_accent: Gateway
    heading_suffix: ' on the ONDC Network.'
    body: Help make the network's sellers discoverable.
    buttons:
      - label: Become a Gateway
        url: https://portal.ondc.org/
        style: solid
        new_tab: true
---
