# Overview
Agent Skills are folders of instructions, scripts, and resources that agents can discover and use to do things more accurately and efficiently.

# Why Agent Skills?
Agents are increasingly capable, but often don’t have the context they need to do real work reliably. Skills solve this by giving agents access to procedural knowledge and company-, team-, and user-specific context they can load on demand. Agents with access to a set of skills can extend their capabilities based on the task they’re working on.

* For skill authors: Build capabilities once and deploy them across multiple agent products.
* For compatible agents: Support for skills lets end users give agents new capabilities out of the box.
* For teams and enterprises: Capture organizational knowledge in portable, version-controlled packages.

# What can Agent Skills enable?
* Domain expertise: Package specialized knowledge into reusable instructions, from legal review processes to data analysis pipelines.
* New capabilities: Give agents new capabilities (e.g. creating presentations, building MCP servers, analyzing datasets).
* Repeatable workflows: Turn multi-step tasks into consistent and auditable workflows.
* Interoperability: Reuse the same skill across different skills-compatible agent products.

# What are skills?
Agent Skills are a lightweight, open format for extending AI agent capabilities with specialized knowledge and workflows.

At its core, a skill is a folder containing a SKILL.md file. This file includes metadata (name and description, at minimum) and instructions that tell an agent how to perform a specific task. Skills can also bundle scripts, templates, and reference materials.

```
my-skill/
├── SKILL.md          # Required: instructions + metadata
├── scripts/          # Optional: executable code
├── references/       # Optional: documentation
└── assets/           # Optional: templates, resources
```

# How skills work
Skills use progressive disclosure to manage context efficiently:

1. Discovery: At startup, agents load only the name and description of each available skill, just enough to know when it might be relevant.
2. Activation: When a task matches a skill’s description, the agent reads the full SKILL.md instructions into context.
3. Execution: The agent follows the instructions, optionally loading referenced files or executing bundled code as needed.
This approach keeps agents fast while giving them access to more context on demand.

# The SKILL.md file

Every skill starts with a `SKILL.md` file containing YAML frontmatter and Markdown instructions:

```
---
name: pdf-processing
description: Extract PDF text, fill forms, merge files. Use when handling PDFs.
---

# PDF Processing

## When to use this skill
Use this skill when the user needs to work with PDF files...

## How to extract text
1. Use pdfplumber for text extraction...

## How to fill forms
...
```

The following frontmatter is required at the top of SKILL.md:
* name: A short identifier
* description: When to use this skill

The Markdown body contains the actual instructions and has no specific restrictions on structure or content.
This simple format has some key advantages:

* Self-documenting: A skill author or user can read a SKILL.md and understand what it does, making skills easy to audit and improve.
* Extensible: Skills can range in complexity from just text instructions to executable code, assets, and templates.
* Portable: Skills are just files, so they’re easy to edit, version, and share.

# `SKILL.md` format

The SKILL.md file must contain YAML frontmatter followed by Markdown content.

## Frontmatter

| Field | Required | Constraints |
| --- | --- | --- |
| name | Yes | Max 64 characters. Lowercase letters, numbers, and hyphens only. Must not start or end with a hyphen. |
| description | Yes | Max 1024 characters. Non-empty. Describes what the skill does and when to use it. |
| license | No | License name or reference to a bundled license file. |
| compatibility | No | Max 500 characters. Indicates environment requirements (intended product, system packages, network access, etc.). |
| metadata | No | Arbitrary key-value mapping for additional metadata. |
| allowed-tools | No | Space-delimited list of pre-approved tools the skill may use. (Experimental) |

### Minimal example:
```
---
name: skill-name
description: A description of what this skill does and when to use it.
---
```

### Example with optional fields:
```
---
name: pdf-processing
description: Extract PDF text, fill forms, merge files. Use when handling PDFs.
license: Apache-2.0
metadata:
  author: example-org
  version: "1.0"
---
```

`name` field
The required name field:
* Must be 1-64 characters
* May only contain unicode lowercase alphanumeric characters (a-z) and hyphens (-)
* Must not start or end with a hyphen (-)
* Must not contain consecutive hyphens (--)
* Must match the parent directory name

`description` field
The required description field:
* Must be 1-1024 characters
* Should describe both what the skill does and when to use it
* Should include specific keywords that help agents identify relevant tasks

`license` field
The optional license field:
* Specifies the license applied to the skill
* We recommend keeping it short (either the name of a license or the name of a bundled license file)

`compatibility` field
The optional compatibility field:
* Must be 1-500 characters if provided
* Should only be included if your skill has specific environment requirements
* Can indicate intended product, required system packages, network access needs, etc.

`metadata` field
The optional metadata field:
* A map from string keys to string values
* Clients can use this to store additional properties not defined by the Agent Skills spec
* We recommend making your key names reasonably unique to avoid accidental conflicts

`allowed-tools` field
The optional allowed-tools field:
* A space-delimited list of tools that are pre-approved to run
* Experimental. Support for this field may vary between agent implementations

## Body content
The Markdown body after the frontmatter contains the skill instructions. There are no format restrictions. Write whatever helps agents perform the task effectively.

Recommended sections:
* Step-by-step instructions
* Examples of inputs and outputs
* Common edge cases

Note that the agent will load this entire file once it’s decided to activate a skill. Consider splitting longer SKILL.md content into referenced files.


## Optional directories
​
`scripts/`
Contains executable code that agents can run. Scripts should:
* Be self-contained or clearly document dependencies
* Include helpful error messages
* Handle edge cases gracefully

Supported languages depend on the agent implementation. Common options include Python, Bash, and JavaScript.


`references/`
Contains additional documentation that agents can read when needed:
* REFERENCE.md - Detailed technical reference
* FORMS.md - Form templates or structured data formats
* Domain-specific files (finance.md, legal.md, etc.)

Keep individual reference files focused. Agents load these on demand, so smaller files mean less use of context.


`assets/`
Contains static resources:
* Templates (document templates, configuration templates)
* Images (diagrams, examples)
* Data files (lookup tables, schemas)

## Progressive disclosure
Skills should be structured for efficient use of context:
1. Metadata (~100 tokens): The name and description fields are loaded at startup for all skills
2. Instructions (< 5000 tokens recommended): The full SKILL.md body is loaded when the skill is activated
3. Resources (as needed): Files (e.g. those in scripts/, references/, or assets/) are loaded only when required

Keep your main SKILL.md under 500 lines. Move detailed reference material to separate files.