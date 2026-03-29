Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName) ' resolves to this file's folder
WshShell.Run chr(34) & scriptDir & "\pm2-start.bat" & chr(34), 0
Set WshShell = Nothing
