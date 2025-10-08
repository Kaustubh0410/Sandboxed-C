import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Play, Terminal, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import axios from 'axios';

interface ExecutionResult {
  stdout: string;
  stderr: string;
  compileError: string;
  exitCode: number;
  timedOut: boolean;
}

const defaultCode = `#include <stdio.h>

int main() {
    printf("Hello, World!\\n");
    return 0;
}`;

const Index = () => {
  const [code, setCode] = useState(defaultCode);
  const [stdin, setStdin] = useState('');
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const handleEditorChange = (value: string | undefined) => {
    setCode(value || '');
  };

  const runCode = async () => {
    setIsRunning(true);
    setResult(null);
    
    try {
      const response = await axios.post('http://localhost:3001/api/run', {
        code,
        stdin
      });
      setResult(response.data);
    } catch (error) {
      console.error('Error running code:', error);
      setResult({
        stdout: '',
        stderr: 'Failed to connect to backend server',
        compileError: '',
        exitCode: -1,
        timedOut: false
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusBadge = () => {
    if (!result) return null;
    
    if (result.compileError) {
      return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Compile Error</Badge>;
    }
    if (result.timedOut) {
      return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Timed Out</Badge>;
    }
    if (result.exitCode === 0) {
      return <Badge variant="default" className="gap-1 bg-success text-success-foreground"><CheckCircle className="h-3 w-3" />Success</Badge>;
    }
    return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Runtime Error</Badge>;
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">Online C Compiler</h1>
          <p className="text-muted-foreground">Write, compile, and run C code in a secure sandbox environment</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Code Editor Panel */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Code Editor</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="border-code-border border rounded-md overflow-hidden">
                  <Editor
                    height="400px"
                    language="c"
                    value={code}
                    onChange={handleEditorChange}
                    theme="vs-dark"
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      lineNumbers: 'on',
                      roundedSelection: false,
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Standard Input</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Enter input data for your program..."
                  value={stdin}
                  onChange={(e) => setStdin(e.target.value)}
                  className="min-h-[100px] bg-code-bg border-code-border"
                />
              </CardContent>
            </Card>

            <Button 
              onClick={runCode} 
              disabled={isRunning}
              className="w-full"
              size="lg"
            >
              {isRunning ? (
                <>
                  <Terminal className="mr-2 h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run Code
                </>
              )}
            </Button>
          </div>

          {/* Output Panel */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Output</CardTitle>
                  {getStatusBadge()}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {result && (
                  <>
                    {result.compileError && (
                      <div>
                        <h4 className="text-sm font-medium mb-2 text-error">Compilation Error</h4>
                        <pre className="bg-code-bg border border-code-border rounded p-3 text-sm overflow-auto text-error">
                          {result.compileError}
                        </pre>
                      </div>
                    )}

                    {!result.compileError && (
                      <>
                        <div>
                          <h4 className="text-sm font-medium mb-2">Standard Output</h4>
                          <pre className="bg-code-bg border border-code-border rounded p-3 text-sm overflow-auto min-h-[80px]">
                            {result.stdout || '(no output)'}
                          </pre>
                        </div>

                        {result.stderr && (
                          <div>
                            <h4 className="text-sm font-medium mb-2 text-warning">Standard Error</h4>
                            <pre className="bg-code-bg border border-code-border rounded p-3 text-sm overflow-auto text-warning">
                              {result.stderr}
                            </pre>
                          </div>
                        )}

                        <Separator />
                        
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <span>Exit Code: {result.exitCode}</span>
                          <span>Time Limit: 3s | Memory Limit: 256MB</span>
                        </div>
                      </>
                    )}
                  </>
                )}

                {!result && !isRunning && (
                  <div className="bg-code-bg border border-code-border rounded p-3 text-sm text-muted-foreground min-h-[200px] flex items-center justify-center">
                    Click "Run Code" to see output here
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Examples */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Example Programs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Button
                variant="outline"
                onClick={() => setCode(defaultCode)}
                className="h-auto p-3 text-left"
              >
                <div>
                  <div className="font-medium">Hello World</div>
                  <div className="text-xs text-muted-foreground">Basic output</div>
                </div>
              </Button>
              
              <Button
                variant="outline"
                onClick={() => setCode(`#include <stdio.h>

int main() {
    char name[100];
    printf("Enter your name: ");
    scanf("%s", name);
    printf("Hello, %s!\\n", name);
    return 0;
}`)}
                className="h-auto p-3 text-left"
              >
                <div>
                  <div className="font-medium">User Input</div>
                  <div className="text-xs text-muted-foreground">Read from stdin</div>
                </div>
              </Button>

              <Button
                variant="outline"
                onClick={() => setCode(`#include <stdio.h>

int main() {
    int *p = NULL;
    *p = 42;  // This will cause a segfault
    return 0;
}`)}
                className="h-auto p-3 text-left"
              >
                <div>
                  <div className="font-medium">Segfault Test</div>
                  <div className="text-xs text-muted-foreground">Runtime error</div>
                </div>
              </Button>

              <Button
                variant="outline"
                onClick={() => setCode(`#include <stdio.h>

int main() {
    while(1) {
        printf("Infinite loop...\\n");
    }
    return 0;
}`)}
                className="h-auto p-3 text-left"
              >
                <div>
                  <div className="font-medium">Timeout Test</div>
                  <div className="text-xs text-muted-foreground">Will timeout after 3s</div>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;