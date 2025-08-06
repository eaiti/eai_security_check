# GitHub Copilot Instructions

Guidelines for working with the EAI Security Check project - a cross-platform Node.js + TypeScript security auditing tool that produces end-user executables.

## Project Mission
**SECURITY IS PARAMOUNT** - This tool audits critical security settings on user systems. Code quality, reliability, and security are non-negotiable requirements since end users depend on this tool to protect their systems.

## Project Overview
This is a **cross-platform enterprise security auditing tool** that:
- **Checks security settings** on macOS, Linux, and Windows systems
- **Compares settings against configurable security profiles** (strict, relaxed, developer, etc.)
- **Produces tamper-proof reports** with cryptographic signatures for verification
- **Enables report sharing and verification** in enterprise environments
- **Provides educational explanations** and remediation guidance for security issues

**Enterprise Focus**: Designed for corporate security compliance, audit trails, and distributed security monitoring across diverse computing environments.

## Project Structure
- **CLI**: `src/` - Main TypeScript codebase with security checkers for macOS, Linux, Windows
- **UI**: `ui/` - Angular + Electron desktop application
- **Executables**: Built for distribution to end users via `npm run pkg:build`
- **Tests**: Jest tests adjacent to source files (`.test.ts` files)
- **Config**: JSON security profiles in `examples/` and `bin/config/`

## Essential Development Rules

### Code Quality (ALWAYS ENFORCE)
- **ESLint**: Fix ALL warnings and errors before committing
  - CLI: `npm run lint` and `npm run lint:fix`  
  - UI: `npm run lint:ui` and `npm run lint:ui:fix`
- **Prettier**: Format all code consistently
  - `npm run format` or `npm run format:all`
- **TypeScript**: Strict mode enabled (includes `noImplicitAny`, `noImplicitReturns`, `noImplicitThis`, `noImplicitOverride`, etc.)

### Testing (ALWAYS REQUIRED)
- **All tests must pass**: `npm test` (CLI) and `cd ui && npm test` (UI)
- **New features require tests**: Mock system commands using `src/test-utils/mocks.ts`
- **Test both success/failure scenarios** for security checks
- **High coverage required** for security-critical code

### Security Requirements
- **No `any` types** - All code must be properly typed
- **Input validation** - Validate all user inputs and system command outputs
- **Error handling** - Graceful handling of all failure scenarios
- **Cross-platform testing** - Verify functionality on target operating systems
- **Enterprise security standards** - Code must meet enterprise-grade security requirements
- **Tamper-proof reporting** - All reports include cryptographic signatures for integrity verification
- **Secure command execution** - Never execute user-provided commands directly

## Architecture Patterns

### Security Checks
1. Define interfaces in `src/types.ts`
2. Implement in platform checkers (`src/checkers/`)
3. Add configuration to security profiles
4. Include educational explanations
5. **Always add comprehensive tests**

### System Integration
- Use `child_process.exec` for system commands
- Handle cross-platform differences gracefully (macOS, Linux, Windows)
- Parse command output reliably (plist, JSON, text, registry)
- Implement proper error handling and timeouts
- Compare actual settings against configurable security profiles
- Generate cryptographically signed reports for enterprise verification

### Key Components
- `src/services/auditor.ts`: Main orchestration engine
- `src/checkers/`: Platform-specific security checkers
- `src/cli/`: Commander.js CLI interface
- `ui/`: Angular + Electron desktop app
- Security profiles: JSON configs for different security levels

## Development Workflow
1. **Always run tests**: Ensure `npm test` passes
2. **Fix lint issues**: Run `npm run lint:fix:all` 
3. **Format code**: Run `npm run format:all`
4. **Verify builds**: Run `npm run build` and `npm run build:ui`
5. **Test cross-platform** when adding system integrations

## Common Patterns & Anti-Patterns

### System Command Execution
- **Always use `child_process.exec` wrapped in `execAsync`**
- **Handle platform differences**: Check for multiple command variations
- **Graceful error handling**: Continue execution when individual checks fail
- **Parse output reliably**: Handle empty, malformed, or missing output

### Error Handling Pattern
```typescript
try {
  const { stdout } = await execAsync('command');
  return stdout.includes('expected-value');
} catch (error) {
  console.error('Error checking feature:', error);
  return false; // Default safe state
}
```

### Testing Requirements
- **Mock all system commands** using `src/test-utils/mocks.ts`
- **Test success AND failure scenarios** for every security check
- **Platform-specific test cases** for cross-platform features
- **Use descriptive test names** explaining the scenario being tested

### Adding New Security Checks (Step-by-Step)
1. **Define interface** in `src/types.ts` (add to `ISecurityChecker`)
2. **Implement in checkers**: Add method to platform-specific checker classes
3. **Add to config profiles**: Update JSON configs in `examples/`
4. **Write comprehensive tests**: Success, failure, and edge cases
5. **Update documentation**: Add explanations and recommendations

### Configuration Management
- **Cross-platform naming**: Use generic names (`diskEncryption` not `fileVault`)
- **JSON schema validation** for all configuration inputs
- **Educational explanations** for each security check and recommendation
- **Default to secure settings** when configuration is missing

## Key Technologies
- **CLI**: Node.js, TypeScript, Commander.js, Jest
- **UI**: Angular 20+, Electron, Material Design
- **System**: Cross-platform command execution, JSON configs
- **Security**: Cryptographic report verification, tamper detection
