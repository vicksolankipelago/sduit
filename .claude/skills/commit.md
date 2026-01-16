# Commit Skill

Create a git commit following the project's JIRA-based commit conventions.

## Commit Message Format

```
[TICKET-NUMBER] type: short description

Optional longer description explaining the changes in more detail.
```

## Rules

1. **Always include the JIRA ticket number** in square brackets at the start
   - Format: `[POLICE-XXX]` where XXX is the ticket number
   - If no ticket is specified, ask the user for the ticket number

2. **Commit types** (lowercase):
   - `feat`: New feature
   - `fix`: Bug fix
   - `refactor`: Code refactoring (no functional change)
   - `style`: Formatting, styling changes
   - `docs`: Documentation only
   - `test`: Adding or updating tests
   - `chore`: Build, config, or tooling changes
   - `perf`: Performance improvements

3. **Short description**:
   - Imperative mood ("add feature" not "added feature")
   - No period at the end
   - Max 50 characters after the type

4. **Examples**:
   ```
   [POLICE-843] feat: add Supabase authentication
   [POLICE-843] fix: resolve WebRTC connection error
   [POLICE-843] refactor: migrate voiceAgent hooks to new repo
   [POLICE-843] chore: update Azure OpenAI endpoint config
   ```

## Instructions

When the user runs `/commit`:

1. Run `git status` to see staged and unstaged changes
2. Run `git diff --staged` to see what will be committed
3. If nothing is staged, ask if they want to stage all changes
4. Analyze the changes and determine the appropriate commit type
5. Generate a commit message following the format above
6. Ask for the JIRA ticket number if not provided (default to current branch ticket if detectable)
7. Create the commit with the formatted message

## Current Default Ticket

For this project, the current working ticket is: **POLICE-843**
