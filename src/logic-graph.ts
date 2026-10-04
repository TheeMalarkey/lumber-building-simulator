/** Iterative Kosaraju: source-first strongly connected components. No recursive
 * traversal or propagation limit for long, valid acyclic circuits. */
export function orderedComponents(edges:Map<string,Set<string>>):string[][]{
 const reverse=new Map([...edges.keys()].map(id=>[id,new Set<string>()]));
 for(const [id,targets] of edges)for(const target of targets)reverse.get(target)!.add(id);
 const visited=new Set<string>(),order:string[]=[];
 for(const id of edges.keys()){
  if(visited.has(id))continue;
  const stack:{id:string;next:Iterator<string>}[]=[{id,next:edges.get(id)!.values()}];visited.add(id);
  while(stack.length){const top=stack.at(-1)!,next=top.next.next();
   if(next.done){order.push(top.id);stack.pop();}
   else if(!visited.has(next.value)){visited.add(next.value);stack.push({id:next.value,next:edges.get(next.value)!.values()});}
  }
 }
 visited.clear();const components:string[][]=[];
 for(let i=order.length-1;i>=0;i--){const id=order[i];if(visited.has(id))continue;
  const component:string[]=[],stack=[id];visited.add(id);
  while(stack.length){const current=stack.pop()!;component.push(current);for(const next of reverse.get(current)!)if(!visited.has(next)){visited.add(next);stack.push(next);}}
  components.push(component);
 }return components;
}
