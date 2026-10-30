
export class LinkItem{
  constructor(){
    this._last = null;
    this._next = null;
  }

  set next(next){
    if (next instanceof LinkItem){
      this._next = next;
    }else{
      if (next != null) throw `error next set to non link item`
      this._next = null;
    }
  }

  get next(){
    return this._next;
  }

  set last(last){
    if (last instanceof LinkItem){
      this._last = last;
    }else{
      if (last != null) throw `error last set to non link item`
      this._last = null;
    }
  }

  get last(){
    return this._last;
  }

  link(l2){
    this.next = l2;
    l2.last = this
  }

  break(dir = 'both'){
    if (dir === 'next'){
      if (this.next != null){
        this.next.last = null;
        this.next = null;
      }
    }else if (dir === 'last'){
      if (this.last != null){
        this.last.next = null;
        this.last = null;
      }
    }else if(dir === 'both'){
      if (this.last != null){
        this.last.next = null;
        this.last = null;
      }
      if (this.next != null){
        this.next.last = null;
        this.next = null;
      }
    }
  }

  clear(){
    this.last = null;
    this.next = null;
  }
}

const LinkListMainMethods = ["push", "pop", "dequeue", "queue", "clear", "find", "insertAfter", "rotateTo"]
export class LinkList{
  constructor(){
    this._start = null;
    this._end = null;
    this._length = 0;
  }

  get length(){
    return this._length;
  }

  get isEmpty(){
    if (this._length == 0 || this.end == null || this.start === null) {
      if (this._length != 0) {
        console.log("invalid length" + this._length);
        this._length = 0;
      }
      return true;
    }
    return false;
  }

  set start(start){
    if (start instanceof LinkItem){
      this._start = start;
      start.last = null;
    }else{
      if (start != null) throw `error start set to non link item`
      this._start = null;
    }
  }

  get start(){
    return this._start;
  }

  set end(end){
    if (end instanceof LinkItem){
      this._end = end;
      end.next = null
    }else{
      if (end != null) throw `error end set to non link item`
      this._end = null;
    }
  }

  get end(){
    return this._end;
  }

  // Pushes LinkItem or LinkList at the end of this list
  push(item){
    if (item instanceof LinkItem){
      //if the node was unset <start> => item <= <end>
      if (this.isEmpty){
        this.start = item; // <start> => <item>
        this.end = item;   // <end> = <item>

        //Otherwise end refers to <end> <=> <item>
      }else{//                    <end> = item

        this.end.link(item);
        this.end = item;
      }

      this._length ++;
    }else if(item instanceof LinkList){
      if (this.isEmpty) {
        this.end = item.end;
        this.start = item.start;
        this._length = item.length;
      } else {
        this.end.link(item.start);
        this.end = item.end;
        this._length += item.length;
      }
      item.clear();
    }
  }


  // Pop linked item from the end of the list
  pop(){
    if (this.isEmpty){
      return null
    }else if (this.end == this.start){
      this._length = 0;
      let temp = this.end;
      this.end = null;
      this.start = null;
      return temp;
    }else{
      this._length--;
      let oldl = this.end;
      let newl = this.end.last;
      oldl.break();
      this.end = newl;
      return oldl
    }
  }

  // Dequeue linked item from the start of the list
  dequeue(){
    if (this.length > 1){
      this._length --;
      let oldl = this.start;
      let newl = this.start.next;
      oldl.break();
      this.start = newl;
      return oldl
    } else {
      return this.pop();
    }
  }

  // Puts LinkList or LinkItem at start of this list
  queue(item){
    if (this.isEmpty){
      if (item instanceof LinkItem){
        item.clear();
        item.link(this.start);
        this.start = item;
        this._length ++;
      } else if(item instanceof LinkList){
        item.end.link(this.start);
        this.start = item.start;
        this._length += item.length;
        item.clear();
      }
    } else {
      this.push(item);
    }
  }

  *[Symbol.iterator]() {
    let start = this.start;
    while (start instanceof LinkItem) {
      yield start;
      if (start == this.end) break;
      start = start.next;
    }
  }

  forEach(visit){
    if (!(visit instanceof Function)){
      throw 'forEach expects a function as its first parameter'
      return
    }

    let cur = this.start;
    let i = 0;
    visit(cur, i);
    while (cur != this.end){
      if (cur.next == null){
        throw 'List is disjointed'
        return
      }else{
        cur = cur.next;
        i++;
        visit(cur, i);
      }
    }
  }

  clear(){
    this._end = null;
    this._start = null;
    this._length = 0;
  }

  find(node) {
    let found = null;
    let i = 0;
    if (node instanceof LinkItem) {
      for (let item of this) {
        i++
        if (item == node) {
          found = item;
          break;
        }
      }
    }
    return [found, i];
  }

  insertAfter(before, item) {
    [before] = this.find(before)
    if (before == null)  throw 'Item before is not in list.'

    if (before == this.end || this.isEmpty) {
      this.push(item);
    } else {
      let after = before.next;
      if (item instanceof LinkItem) {
        before.link(item);
        item.link(after);
        this._length ++;
      } else if (item instanceof LinkList) {
        before.link(item.start);
        item.end.link(after);
        this._length += item.length;
        item.clear();
      }
    }
  }

  rotateTo(item) {
    [item] = this.find(item);
    if (item == null) throw "Item not a LinkItem";
    let end = item.last;
    if (end != null) {
      this.end.link(this.start);
      this.start = item;
      this.end = end;
    }
  }
}