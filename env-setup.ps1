# 开发环境一键配置脚本（每次新开 PowerShell 先运行此脚本，或把路径加入系统环境变量）
# 用法：. .\env-setup.ps1
$env:JAVA_HOME = "D:\dev\tools\jdk-21.0.2"
$env:ANDROID_HOME = "D:\dev\tools\android-sdk"
$env:ANDROID_SDK_ROOT = "D:\dev\tools\android-sdk"
$env:PG_HOME = "D:\dev\tools\pgsql\pgsql"
# 把各 bin 加入 PATH
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:ANDROID_HOME\platform-tools;$env:PG_HOME\bin;$env:Path"
Write-Output "环境变量已配置："
Write-Output "  JAVA_HOME    = $env:JAVA_HOME"
Write-Output "  ANDROID_HOME = $env:ANDROID_HOME"
Write-Output "  PG_HOME      = $env:PG_HOME"
