  -- UrbanIQ seed data: 3 pre-built scenarios from PROJECT.md

  INSERT INTO scenarios (
    id,
    name,
    description,
    policy_type,
    location,
    budget_pkr,
    parameters,
    result,
    ai_response,
    sort_order
  ) VALUES
  (
    'a1000001-0000-4000-8000-000000000001',
    'Kalma Chowk Flyover',
    'Helps central traffic flow around Gulberg but pushes flood risk into Model Town and Garden Town.',
    'flyover',
    ST_SetSRID(ST_MakePoint(74.3458, 31.5089), 4326),
    8500000000,
    '{"lanes": 4}'::jsonb,
    '{
      "simulation_id": "seed-kalma-chowk-flyover",
      "processing_time_ms": 42,
      "city_totals": {
        "before": {
          "traffic_score": 78,
          "flood_risk": 45,
          "emergency_minutes": 8.2,
          "economic_score": 58
        },
        "after": {
          "traffic_score": 67,
          "flood_risk": 61,
          "emergency_minutes": 7.8,
          "economic_score": 55
        }
      },
      "affected_zones": [
        {
          "zone_id": "gulberg",
          "zone_name": "Gulberg",
          "polygon": {
            "type": "Polygon",
            "coordinates": [[[74.304, 31.467], [74.4, 31.467], [74.4, 31.563], [74.304, 31.563], [74.304, 31.467]]]
          },
          "before": { "traffic_score": 78, "flood_risk": 45, "emergency_minutes": 8.2 },
          "after": { "traffic_score": 64, "flood_risk": 53, "emergency_minutes": 7.6 }
        },
        {
          "zone_id": "model-town",
          "zone_name": "Model Town",
          "polygon": {
            "type": "Polygon",
            "coordinates": [[[74.235, 31.424], [74.335, 31.424], [74.335, 31.52], [74.235, 31.52], [74.235, 31.424]]]
          },
          "before": { "traffic_score": 62, "flood_risk": 65, "emergency_minutes": 9.8 },
          "after": { "traffic_score": 55, "flood_risk": 83, "emergency_minutes": 9.6 }
        },
        {
          "zone_id": "garden-town",
          "zone_name": "Garden Town",
          "polygon": {
            "type": "Polygon",
            "coordinates": [[[74.278, 31.462], [74.358, 31.462], [74.358, 31.538], [74.278, 31.538], [74.278, 31.462]]]
          },
          "before": { "traffic_score": 71, "flood_risk": 42, "emergency_minutes": 7.9 },
          "after": { "traffic_score": 62, "flood_risk": 51, "emergency_minutes": 7.5 }
        }
      ]
    }'::jsonb,
    '{
      "verdict": "conditional",
      "executive_summary": "The flyover reduces congestion around Gulberg and Garden Town, but it creates a serious drainage tradeoff for Model Town. Approve only with a funded stormwater package and traffic diversion plan.",
      "impact_scores": {
        "traffic": 5,
        "flood": -4,
        "emergency": 1,
        "economic": 3,
        "environment": -3
      },
      "risks": [
        {
          "title": "Model Town flood exposure",
          "description": "Added impermeable surface near an already vulnerable residential zone raises flood risk sharply.",
          "severity": "high"
        },
        {
          "title": "Induced traffic demand",
          "description": "Short-term travel-time gains may be absorbed by new vehicle trips within a few years.",
          "severity": "medium"
        },
        {
          "title": "Construction disruption",
          "description": "Kalma Chowk works would temporarily slow emergency and commuter routes through Gulberg.",
          "severity": "medium"
        }
      ],
      "benefits": [
        {
          "title": "Central congestion relief",
          "description": "Gulberg and Garden Town see meaningful reductions in traffic pressure."
        },
        {
          "title": "Commercial access",
          "description": "Improved flow supports retail and office districts near Kalma Chowk."
        },
        {
          "title": "Minor emergency gains",
          "description": "Response times improve slightly for nearby central zones."
        }
      ],
      "alternatives": [
        {
          "title": "Signal optimization and bus priority",
          "description": "Upgrade junction timing and reserve peak-hour bus movement before adding elevated road capacity.",
          "estimated_cost_pkr": 1600000000,
          "expected_improvement": "6-8% traffic improvement with lower flood risk"
        },
        {
          "title": "Kalma drainage package",
          "description": "Pair any road project with detention tanks and trunk drain capacity around Model Town.",
          "estimated_cost_pkr": 2400000000,
          "expected_improvement": "Offsets most of the projected flood-risk increase"
        }
      ],
      "cost_benefit_summary": "The project has visible traffic benefits but weak resilience value unless drainage mitigation is funded in the same approval."
    }'::jsonb,
    1
  ),
  (
    'a1000001-0000-4000-8000-000000000002',
    'Johar Town Hospital',
    'Adds hospital capacity in an underserved southern cluster and improves emergency response across six zones.',
    'hospital',
    ST_SetSRID(ST_MakePoint(74.2728, 31.4697), 4326),
    2100000000,
    '{"beds": 350}'::jsonb,
    '{
      "simulation_id": "seed-johar-town-hospital",
      "processing_time_ms": 39,
      "city_totals": {
        "before": {
          "traffic_score": 58,
          "flood_risk": 46,
          "emergency_minutes": 18.4,
          "economic_score": 52
        },
        "after": {
          "traffic_score": 57,
          "flood_risk": 46,
          "emergency_minutes": 11.2,
          "economic_score": 61
        }
      },
      "affected_zones": [
        {
          "zone_id": "johar-town",
          "zone_name": "Johar Town",
          "polygon": {
            "type": "Polygon",
            "coordinates": [[[74.198, 31.416], [74.306, 31.416], [74.306, 31.52], [74.198, 31.52], [74.198, 31.416]]]
          },
          "before": { "traffic_score": 48, "flood_risk": 40, "emergency_minutes": 18.4 },
          "after": { "traffic_score": 50, "flood_risk": 40, "emergency_minutes": 11.2 }
        },
        {
          "zone_id": "township",
          "zone_name": "Township",
          "polygon": {
            "type": "Polygon",
            "coordinates": [[[74.164, 31.373], [74.28, 31.373], [74.28, 31.483], [74.164, 31.483], [74.164, 31.373]]]
          },
          "before": { "traffic_score": 52, "flood_risk": 38, "emergency_minutes": 21.2 },
          "after": { "traffic_score": 53, "flood_risk": 38, "emergency_minutes": 15.6 }
        },
        {
          "zone_id": "allama-iqbal-town",
          "zone_name": "Allama Iqbal Town",
          "polygon": {
            "type": "Polygon",
            "coordinates": [[[74.22, 31.393], [74.336, 31.393], [74.336, 31.503], [74.22, 31.503], [74.22, 31.393]]]
          },
          "before": { "traffic_score": 67, "flood_risk": 55, "emergency_minutes": 11.3 },
          "after": { "traffic_score": 67, "flood_risk": 55, "emergency_minutes": 8.1 }
        }
      ]
    }'::jsonb,
    '{
      "verdict": "recommended",
      "executive_summary": "A hospital in Johar Town closes the largest emergency response gap in the model. The benefits spread to Township, Faisal Town, and Allama Iqbal Town without creating major flood or traffic penalties.",
      "impact_scores": {
        "traffic": -1,
        "flood": 0,
        "emergency": 8,
        "economic": 5,
        "environment": 0
      },
      "risks": [
        {
          "title": "Access-road congestion",
          "description": "Ambulance access can degrade if surrounding junctions are not managed during peak hours.",
          "severity": "medium"
        },
        {
          "title": "Operating cost pressure",
          "description": "Capital spending only works if staffing and recurring clinical budgets are secured.",
          "severity": "medium"
        },
        {
          "title": "Land acquisition delay",
          "description": "A poorly selected site could delay delivery and reduce the catchment benefit.",
          "severity": "low"
        }
      ],
      "benefits": [
        {
          "title": "Emergency response improvement",
          "description": "Johar Town and Township see the largest reductions in hospital travel time."
        },
        {
          "title": "Southern Lahore coverage",
          "description": "The project fills a clear service gap away from the better-served central and cantonment areas."
        },
        {
          "title": "High social return",
          "description": "The budget is materially lower than a major flyover while improving life-safety outcomes."
        }
      ],
      "alternatives": [
        {
          "title": "Trauma stabilization centers",
          "description": "Build smaller emergency units in Johar Town and Township with ambulance transfer protocols.",
          "estimated_cost_pkr": 900000000,
          "expected_improvement": "20-25% emergency improvement at lower capital cost"
        },
        {
          "title": "Ambulance network expansion",
          "description": "Add vehicles and dispatch optimization before committing to full hospital construction.",
          "estimated_cost_pkr": 450000000,
          "expected_improvement": "Fast near-term response gains across southern zones"
        }
      ],
      "cost_benefit_summary": "The hospital scenario has the strongest public-value profile because it targets the largest service gap with limited negative spillover."
    }'::jsonb,
    2
  ),
  (
    'a1000001-0000-4000-8000-000000000003',
    'Lahore Drainage Network Upgrade',
    'A city-wide drainage investment that reduces flood risk most strongly in Walled City, Model Town, and Allama Iqbal Town.',
    'drainage',
    ST_SetSRID(ST_MakePoint(74.3587, 31.5204), 4326),
    3800000000,
    '{"pipe_diameter": 1.8}'::jsonb,
    '{
      "simulation_id": "seed-lahore-drainage-network-upgrade",
      "processing_time_ms": 51,
      "city_totals": {
        "before": {
          "traffic_score": 62,
          "flood_risk": 54,
          "emergency_minutes": 11.5,
          "economic_score": 50
        },
        "after": {
          "traffic_score": 62,
          "flood_risk": 32,
          "emergency_minutes": 10.8,
          "economic_score": 64
        }
      },
      "affected_zones": [
        {
          "zone_id": "walled-city",
          "zone_name": "Walled City",
          "polygon": {
            "type": "Polygon",
            "coordinates": [[[74.274, 31.555], [74.35, 31.555], [74.35, 31.625], [74.274, 31.625], [74.274, 31.555]]]
          },
          "before": { "traffic_score": 88, "flood_risk": 82, "emergency_minutes": 6.1 },
          "after": { "traffic_score": 88, "flood_risk": 46, "emergency_minutes": 5.7 }
        },
        {
          "zone_id": "model-town",
          "zone_name": "Model Town",
          "polygon": {
            "type": "Polygon",
            "coordinates": [[[74.235, 31.424], [74.335, 31.424], [74.335, 31.52], [74.235, 31.52], [74.235, 31.424]]]
          },
          "before": { "traffic_score": 62, "flood_risk": 65, "emergency_minutes": 9.8 },
          "after": { "traffic_score": 62, "flood_risk": 34, "emergency_minutes": 9.5 }
        },
        {
          "zone_id": "allama-iqbal-town",
          "zone_name": "Allama Iqbal Town",
          "polygon": {
            "type": "Polygon",
            "coordinates": [[[74.22, 31.393], [74.336, 31.393], [74.336, 31.503], [74.22, 31.503], [74.22, 31.393]]]
          },
          "before": { "traffic_score": 67, "flood_risk": 55, "emergency_minutes": 11.3 },
          "after": { "traffic_score": 67, "flood_risk": 31, "emergency_minutes": 11.0 }
        },
        {
          "zone_id": "gulberg",
          "zone_name": "Gulberg",
          "polygon": {
            "type": "Polygon",
            "coordinates": [[[74.304, 31.467], [74.4, 31.467], [74.4, 31.563], [74.304, 31.563], [74.304, 31.467]]]
          },
          "before": { "traffic_score": 78, "flood_risk": 45, "emergency_minutes": 8.2 },
          "after": { "traffic_score": 78, "flood_risk": 27, "emergency_minutes": 7.9 }
        }
      ]
    }'::jsonb,
    '{
      "verdict": "recommended",
      "executive_summary": "The drainage upgrade produces broad flood-risk reductions citywide, especially in Walled City and Model Town. It should rank above road expansion because it improves resilience without inducing traffic demand.",
      "impact_scores": {
        "traffic": 0,
        "flood": 9,
        "emergency": 2,
        "economic": 6,
        "environment": 5
      },
      "risks": [
        {
          "title": "Excavation disruption",
          "description": "Drain works can disrupt dense streets if construction is not phased around monsoon and market cycles.",
          "severity": "medium"
        },
        {
          "title": "Maintenance dependency",
          "description": "Benefits will decay quickly if desilting and solid-waste controls are not funded.",
          "severity": "medium"
        },
        {
          "title": "Utility conflicts",
          "description": "Underground service conflicts may increase costs in older districts.",
          "severity": "low"
        }
      ],
      "benefits": [
        {
          "title": "Citywide flood reduction",
          "description": "Every district improves, with the largest gains in the highest-risk zones."
        },
        {
          "title": "Resilience return",
          "description": "Lower flood exposure protects homes, businesses, roads, and emergency access during monsoon events."
        },
        {
          "title": "Better than flyover-first spending",
          "description": "The same order of public spending solves a systemic risk instead of shifting congestion and runoff."
        }
      ],
      "alternatives": [
        {
          "title": "Priority-zone drainage first",
          "description": "Start with Walled City, Model Town, and Allama Iqbal Town before citywide rollout.",
          "estimated_cost_pkr": 1900000000,
          "expected_improvement": "Targets 60-70% of flood benefit in the highest-risk zones"
        },
        {
          "title": "Green retention corridors",
          "description": "Use parks, permeable medians, and detention basins to complement pipe upgrades.",
          "estimated_cost_pkr": 1200000000,
          "expected_improvement": "Adds flood and environmental gains with visible public amenities"
        }
      ],
      "cost_benefit_summary": "This is the best seed scenario: moderate cost, broad risk reduction, and fewer harmful second-order effects than road capacity expansion."
    }'::jsonb,
    3
  );
