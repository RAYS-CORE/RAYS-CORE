!macro customInstall
  DetailPrint "Adding RAYS CLI to system PATH"
  ExecWait 'powershell -NoProfile -Command "[Environment]::SetEnvironmentVariable(\"Path\", [Environment]::GetEnvironmentVariable(\"Path\", \"Machine\") + \";$INSTDIR\resources\backend\", \"Machine\")"'
!macroend

!macro customUnInstall
  DetailPrint "Removing RAYS CLI from system PATH"
  ExecWait 'powershell -NoProfile -Command "$$p = [Environment]::GetEnvironmentVariable(\"Path\", \"Machine\"); $$p = $$p -replace [regex]::Escape(\";$INSTDIR\resources\backend\"), \"\"; [Environment]::SetEnvironmentVariable(\"Path\", $$p, \"Machine\")"'
!macroend
