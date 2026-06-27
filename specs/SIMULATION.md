# Simulation Engine Specs

## Endpoint
POST /simulate
Base URL: set in NEXT_PUBLIC_API_URL

## Request Body
{
  policy_type: "flyover" | "hospital" | "drainage" | "school" | "park",
  location: { lat: number, lng: number },
  budget_pkr: number,
  radius_km: number,
  parameters: {
    lanes?: number,          // for flyover
    beds?: number,           // for hospital
    pipe_diameter?: number   // for drainage
  }
}

## Response Body
{
  simulation_id: string,
  affected_zones: [
    {
      zone_id: string,
      zone_name: string,
      polygon: GeoJSON,
      before: {
        traffic_score: number,    // 0-100, higher = worse congestion
        flood_risk: number,       // 0-100, higher = more risk
        emergency_minutes: number // avg response time
      },
      after: {
        traffic_score: number,
        flood_risk: number,
        emergency_minutes: number
      }
    }
  ],
  city_totals: {
    before: { traffic_score, flood_risk, emergency_minutes, economic_score },
    after:  { traffic_score, flood_risk, emergency_minutes, economic_score }
  },
  processing_time_ms: number
}

## The Three Models

### Traffic Model (traffic.py)
- Load Lahore road network as networkx DiGraph
- Each edge has: capacity (vehicles/hour), current_load, length_km
- Policy effect: flyover adds new edges, increases capacity on existing
- Recalculate: average shortest path time across 20 sample OD pairs
- Output: traffic_score delta per zone (negative = improvement)

### Flood Model (flood.py)  
- Each zone has: base_flood_risk, drainage_capacity, elevation
- Policy effect: 
  - flyover adds impermeable_area_sqm, reduces drainage by 15-35%
  - drainage upgrade increases drainage_capacity by 40-60%
- Formula: new_risk = base_risk * (1 + impermeable_ratio) / drainage_factor
- Output: flood_risk delta per zone

### Emergency Model (emergency.py)
- Load hospital locations
- For each zone centroid, calculate drive time to nearest hospital
- Use road graph with current congestion weights
- Policy effect: new hospital adds node, flyover changes edge weights
- Output: emergency_minutes delta per zone

## Lahore Districts (10 zones)
1. Gulberg        — center of simulation, high traffic
2. DHA            — low flood risk, good infrastructure  
3. Model Town     — medium flood risk, residential
4. Johar Town     — far from hospitals, high emergency gap
5. Walled City    — highest flood risk, poor drainage
6. Cantt          — low risk, near hospitals
7. Allama Iqbal Town — medium everything
8. Faisal Town    — medium traffic, medium flood
9. Garden Town    — adjacent to Gulberg
10. Township      — far west, underserved
