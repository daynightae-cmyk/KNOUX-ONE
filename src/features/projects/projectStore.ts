import { useCallback, useMemo, useState } from 'react';
import { NativeClient } from '../../services/nativeClient';
import type { CacheManageResult, CommandManageResult, DependencyAuditResult, EnvironmentAuditResult, GitWorkspaceResult, ProjectDiscoverResult, ProjectHealthResult, ProjectRecord, ProjectStoreError, ProjectTab, ReportFormat, ReportsExportResult, RuntimeManageResult, SourceAnalyzeResult } from './projectContracts';

function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }

export function useProjectStore() {
  const runtime = useMemo(() => NativeClient.getRuntimeState(), []);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [activeProject, setActiveProject] = useState<ProjectRecord | null>(null);
  const [activeTab, setActiveTab] = useState<ProjectTab>('overview');
  const [healthAudit, setHealthAudit] = useState<ProjectHealthResult | null>(null);
  const [dependencyAudit, setDependencyAudit] = useState<DependencyAuditResult | null>(null);
  const [commandState, setCommandState] = useState<CommandManageResult | null>(null);
  const [environmentAudit, setEnvironmentAudit] = useState<EnvironmentAuditResult | null>(null);
  const [sourceAnalyze, setSourceAnalyze] = useState<SourceAnalyzeResult | null>(null);
  const [cacheManage, setCacheManage] = useState<CacheManageResult | null>(null);
  const [gitWorkspace, setGitWorkspace] = useState<GitWorkspaceResult | null>(null);
  const [runtimeState, setRuntimeState] = useState<RuntimeManageResult | null>(null);
  const [reportsExport, setReportsExport] = useState<ReportsExportResult | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState<ProjectStoreError | null>(null);
  const requireDesktop = useCallback(() => { if (runtime.available) return true; setError({code:'desktop_runtime_unavailable',message:runtime.reasonEn??'Open KNOUX ONE Desktop to inspect local projects.'}); return false; },[runtime]);
  const run=useCallback(async<T,>(action:string,capabilityId:string,handlerId:string,parameters:Record<string,unknown>):Promise<T|null>=>{if(!requireDesktop())return null;setLoadingAction(action);setError(null);try{const result=await NativeClient.executeCapability<T>(capabilityId,handlerId,parameters);if((result.status==='completed'||result.status==='completed_with_warnings')&&result.data){if(result.warnings.length)setError({code:'completed_with_warnings',message:result.warnings.join('\n')});return result.data;}setError({code:result.errorCode??result.status,message:result.summaryEn});return null;}catch(cause){setError({code:'native_execution_failed',message:errorMessage(cause)});return null;}finally{setLoadingAction(null);}},[requireDesktop]);
  const discoverProjects=useCallback(async(roots:string[])=>{const data=await run<ProjectDiscoverResult>('discover','m16_s01','m16.projects.discover',{request:{roots,maxDepth:6}});if(data){setProjects(data.projects);setActiveProject(previous=>data.projects.find(project=>project.id===previous?.id)??data.projects[0]??null);}},[run]);
  const auditHealth=useCallback(async(projectPath:string)=>{const data=await run<ProjectHealthResult>('health','m16_s02','m16.projects.health',{request:{projectPath}});if(data)setHealthAudit(data);},[run]);
  const auditDependencies=useCallback(async(projectPath:string)=>{const data=await run<DependencyAuditResult>('dependencies','m16_s03','m16.dependencies.audit',{request:{projectPath}});if(data)setDependencyAudit(data);},[run]);
  const listTasks=useCallback(async(projectPath:string)=>{const data=await run<CommandManageResult>('tasks','m16_s04','m16.commands.execute',{request:{action:'list',projectPath}});if(data)setCommandState(data);},[run]);
  const executeTask=useCallback(async(projectPath:string,taskId:string,confirmation?:string)=>{const data=await run<CommandManageResult>('execute-task','m16_s04','m16.commands.execute',{request:{action:'execute',projectPath,taskId,confirmation:confirmation||null}});if(data)setCommandState(data);},[run]);
  const auditEnvironment=useCallback(async(projectPath:string)=>{const data=await run<EnvironmentAuditResult>('environment','m16_s05','m16.environment.audit',{request:{projectPath}});if(data)setEnvironmentAudit(data);},[run]);
  const analyzeSource=useCallback(async(projectPath:string)=>{const data=await run<SourceAnalyzeResult>('source','m16_s06','m16.source.analyze',{request:{projectPath}});if(data)setSourceAnalyze(data);},[run]);
  const inspectCache=useCallback(async(projectPath:string)=>{const data=await run<CacheManageResult>('cache-inspect','m16_s07','m16.cache.manage',{request:{action:'inspect',projectPath}});if(data)setCacheManage(data);},[run]);
  const cleanCache=useCallback(async(projectPath:string,paths:string[],confirmation:string)=>{const data=await run<CacheManageResult>('cache-clean','m16_s07','m16.cache.manage',{request:{action:'clean',projectPath,paths,confirmation}});if(data)setCacheManage(data);},[run]);
  const checkGitWorkspace=useCallback(async(projectPath:string)=>{const data=await run<GitWorkspaceResult>('git','m16_s08','m16.git.workspace',{request:{projectPath}});if(data)setGitWorkspace(data);},[run]);
  const inspectRuntime=useCallback(async(projectPath:string)=>{const data=await run<RuntimeManageResult>('runtime-inspect','m16_s09','m16.runtime.orchestrate',{request:{action:'inspect',projectPath}});if(data)setRuntimeState(data);},[run]);
  const terminateRuntime=useCallback(async(projectPath:string,pid:number,confirmation:string)=>{const data=await run<RuntimeManageResult>('runtime-terminate','m16_s09','m16.runtime.orchestrate',{request:{action:'terminate',projectPath,pid,confirmation}});if(data)setRuntimeState(data);},[run]);
  const exportReport=useCallback(async(projectPath:string,format:ReportFormat,redactAbsolutePaths:boolean)=>{const data=await run<ReportsExportResult>('report','m16_s10','m16.reports.export',{request:{projectPath,format,redactAbsolutePaths}});if(data)setReportsExport(data);},[run]);
  const clearEvidence=useCallback(()=>{setHealthAudit(null);setDependencyAudit(null);setCommandState(null);setEnvironmentAudit(null);setSourceAnalyze(null);setCacheManage(null);setGitWorkspace(null);setRuntimeState(null);setReportsExport(null);},[]);
  const selectProject=useCallback((project:ProjectRecord)=>{setActiveProject(project);clearEvidence();},[clearEvidence]);
  return{runtime,projects,activeProject,activeTab,setActiveTab,selectProject,healthAudit,dependencyAudit,commandState,environmentAudit,sourceAnalyze,cacheManage,gitWorkspace,runtimeState,reportsExport,loadingAction,error,setError,discoverProjects,auditHealth,auditDependencies,listTasks,executeTask,auditEnvironment,analyzeSource,inspectCache,cleanCache,checkGitWorkspace,inspectRuntime,terminateRuntime,exportReport};
}
