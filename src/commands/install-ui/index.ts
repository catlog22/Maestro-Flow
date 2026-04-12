export async function runInstallWizard(
  pkgRoot: string,
  version: string,
): Promise<void> {
  const { render } = await import('ink');
  const React = await import('react');
  const { CyberdeckBlueprint } = await import('./CyberdeckBlueprint.js');

  const { waitUntilExit } = render(
    React.createElement(CyberdeckBlueprint, { pkgRoot, version }),
    { exitOnCtrlC: true },
  );

  // Cleanup handlers
  process.on('SIGINT', () => process.exit(0));
  process.on('SIGTERM', () => process.exit(0));

  await waitUntilExit();
}
