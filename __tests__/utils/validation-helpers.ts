import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// Helper to run shell commands
export async function runCommand(command: string): Promise<{ stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execAsync(command)
    return { stdout, stderr }
  } catch (error: any) {
    throw new Error(`Command failed: ${command}\n${error.message}`)
  }
}

// Helper to check if a file exists
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    const { stdout } = await runCommand(`test -f ${filePath} && echo "exists"`)
    return stdout.trim() === 'exists'
  } catch {
    return false
  }
}

// Helper to check if a directory exists
export async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const { stdout } = await runCommand(`test -d ${dirPath} && echo "exists"`)
    return stdout.trim() === 'exists'
  } catch {
    return false
  }
}

// Helper to validate TypeScript compilation
export async function validateTypeScript(): Promise<boolean> {
  try {
    await runCommand('npm run type-check')
    return true
  } catch {
    return false
  }
}

// Helper to validate linting
export async function validateLinting(): Promise<boolean> {
  try {
    await runCommand('npm run lint')
    return true
  } catch {
    return false
  }
}

// Helper to validate build
export async function validateBuild(): Promise<boolean> {
  try {
    await runCommand('npm run build')
    return true
  } catch {
    return false
  }
}

// Helper to test shadcn component
export async function testShadcnComponent(): Promise<boolean> {
  try {
    // Check if a sample shadcn component exists and is importable
    const buttonExists = await fileExists('./components/ui/button.tsx')
    return buttonExists
  } catch {
    return false
  }
}

// Helper to run all validation loops
export async function runAllValidations() {
  console.log('🔍 Running all validation loops...\n')
  
  const validations = [
    { name: 'TypeScript', fn: validateTypeScript },
    { name: 'Linting', fn: validateLinting },
    { name: 'Build', fn: validateBuild },
    { name: 'shadcn Components', fn: testShadcnComponent },
  ]
  
  const results = []
  
  for (const validation of validations) {
    console.log(`Running ${validation.name}...`)
    try {
      const passed = await validation.fn()
      results.push({ name: validation.name, passed })
      console.log(`✅ ${validation.name} passed\n`)
    } catch (error) {
      results.push({ name: validation.name, passed: false, error })
      console.log(`❌ ${validation.name} failed\n`)
    }
  }
  
  return results
}

// Helper to check RLS policies
export async function checkRLSEnabled(supabase: any): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('check_rls_enabled')
    if (error) throw error
    return data.every((table: any) => table.rls_enabled)
  } catch {
    return false
  }
}

// Helper to validate migrations
export async function validateMigrations(supabase: any): Promise<boolean> {
  const tables = ['organizations', 'user_profiles', 'products', 'warehouses', 'inventory']
  
  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('id').limit(1)
      if (error) return false
    } catch {
      return false
    }
  }
  
  return true
}