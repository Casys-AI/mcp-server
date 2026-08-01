# Component surfaces

This slice resolves an App-owned component catalog against an optional surface requested by a
dashboard. It never renders components and never inspects a child iframe DOM.

The owning MCP App provides component implementations and one default standalone surface. Compose
may select an explicit subset and safe layout by stable component key.
