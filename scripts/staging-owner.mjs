// Deliberately no connection, SQL execution, credential handling or local helper.
// Removing this gate requires a separate reviewed implementation and approval.
console.error('Operação OWNER STAGING bloqueada: identidade da conexão e revisão operacional ainda não verificadas. Nenhuma conexão realizada.')
process.exitCode = 1
