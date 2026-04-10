# Role Categories
<!-- Broad role taxonomy for knowledge-work jobs -->

Classify every job into exactly one broad category and one optional focus.

Use one of these categories:

| Category | ID | Example signals in JD |
|---|---|---|
| Engineering | engineering | software engineer, platform, frontend, backend, developer |
| Product | product | product manager, roadmap, prioritization, discovery, requirements |
| Design | design | product designer, UX, UI, interaction design, visual design |
| Data | data | data scientist, analytics, BI, experimentation, data modeling |
| Architecture | architecture | architect, solution design, enterprise integration, systems strategy |
| Research | research | researcher, user research, applied research, experimentation |
| Consulting | consulting | client-facing, implementation partner, advisory, delivery |
| Operations | operations | enablement, program management, change management, transformation |
| Leadership | leadership | head of, director, VP, org leadership, management |
| Go-To-Market | go_to_market | solutions consulting, sales engineering, customer success, growth |

Set `focus` to a short normalized label when the JD clearly points to a narrower specialty, such as:
- platform
- frontend
- backend
- full_stack
- forward_deployed
- product_design
- technical_pm
- ux_research
- analytics
- ai
- developer_relations
- solutions_architecture

If no narrower specialty is clear, set `focus` to null.
